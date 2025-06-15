import Database from "@tauri-apps/plugin-sql";
import { v4 as uuidv4 } from "uuid";
import { homeDir } from "@tauri-apps/api/path";

export interface DatabaseTask {
  id: string;
  name: string;
  parent_id?: string;
  completed: number; // 0 for false, 1 for true in sqlite
  completed_at?: string;
  date_created: string;
}

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
  if (!db) {
    const home = await homeDir();
    const dbPath = `${home}/.act/act.db`;
    db = await Database.load(`sqlite:${dbPath}`);
  }
  return db;
}

export class DatabaseService {
  static async getAllTasks(): Promise<DatabaseTask[]> {
    const database = await getDatabase();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created FROM tasks ORDER BY date_created ASC"
    );
  }

  static async getTasksByDate(
    startDate: string,
    endDate: string
  ): Promise<DatabaseTask[]> {
    const database = await getDatabase();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created FROM tasks WHERE date_created >= $1 AND date_created <= $2 ORDER BY date_created ASC",
      [startDate, endDate]
    );
  }

  static async getTasksByStatus(completed: boolean): Promise<DatabaseTask[]> {
    const database = await getDatabase();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created FROM tasks WHERE completed = $1 ORDER BY date_created ASC",
      [completed]
    );
  }

  static async getTasksByDateAndStatus(
    startDate: string,
    endDate: string,
    completed: boolean
  ): Promise<DatabaseTask[]> {
    const database = await getDatabase();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created FROM tasks WHERE date_created >= $1 AND date_created <= $2 AND completed = $3 ORDER BY date_created ASC",
      [startDate, endDate, completed]
    );
  }

  static async getTodaysTasks(): Promise<DatabaseTask[]> {
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;
    return await this.getTasksByDate(startOfDay, endOfDay);
  }

  static async getTodaysCompletedTasks(): Promise<DatabaseTask[]> {
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;
    return await this.getTasksByDateAndStatus(startOfDay, endOfDay, true);
  }

  static async getTodaysPendingTasks(): Promise<DatabaseTask[]> {
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;
    return await this.getTasksByDateAndStatus(startOfDay, endOfDay, false);
  }

  static async getTasksForDate(date: Date): Promise<DatabaseTask[]> {
    const dateStr = date.toISOString().split("T")[0];
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;
    return await this.getTasksByDate(startOfDay, endOfDay);
  }

  static async getCompletedTasks(): Promise<DatabaseTask[]> {
    return await this.getTasksByStatus(true);
  }

  static async getPendingTasks(): Promise<DatabaseTask[]> {
    return await this.getTasksByStatus(false);
  }

  static async createTask(
    name: string,
    parent_id?: string
  ): Promise<DatabaseTask> {
    const database = await getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();

    const task: DatabaseTask = {
      id,
      name,
      parent_id,
      completed: 0,
      completed_at: undefined,
      date_created: now,
    };

    await database.execute(
      "INSERT INTO tasks (id, name, parent_id, completed, completed_at, date_created) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        task.id,
        task.name,
        task.parent_id,
        task.completed,
        task.completed_at,
        task.date_created,
      ]
    );

    // Handle parent-child completion logic
    // New task is uncompleted, so if parent was completed, it should become uncompleted
    if (parent_id) {
      await this.handleParentChildCompletion(id);
    }

    return task;
  }

  static async updateTask(id: string, name: string): Promise<void> {
    const database = await getDatabase();
    await database.execute("UPDATE tasks SET name = $1 WHERE id = $2", [
      name,
      id,
    ]);
  }

  static async deleteTask(id: string): Promise<void> {
    const database = await getDatabase();

    // Get the task being deleted to check if it has a parent
    const [taskToDelete] = (await database.select(
      "SELECT id, parent_id, completed FROM tasks WHERE id = $1",
      [id]
    )) as DatabaseTask[];

    // Delete the task and all its subtasks
    await database.execute(
      "DELETE FROM tasks WHERE id = $1 OR parent_id = $1",
      [id]
    );

    // Handle parent-child completion logic
    // If the deleted task had a parent, check if parent should be auto-completed
    if (taskToDelete?.parent_id) {
      // Check remaining siblings after deletion
      const siblings = await this.getSubtasks(taskToDelete.parent_id);

      if (siblings.length > 0) {
        const allSiblingsCompleted = siblings.every((sibling) =>
          Boolean(sibling.completed)
        );

        if (allSiblingsCompleted) {
          // Auto-complete parent
          const now = new Date().toISOString();
          await database.execute(
            "UPDATE tasks SET completed = TRUE, completed_at = $1 WHERE id = $2",
            [now, taskToDelete.parent_id]
          );
          // Recursively check parent's parent
          await this.handleParentChildCompletion(taskToDelete.parent_id);
        }
      }
    }
  }

  static async toggleTaskCompleted(id: string): Promise<void> {
    const database = await getDatabase();
    const now = new Date().toISOString();

    await database.execute(
      "UPDATE tasks SET completed = NOT completed, completed_at = CASE WHEN completed THEN NULL ELSE $1 END WHERE id = $2",
      [now, id]
    );

    // Handle parent-child completion logic
    await this.handleParentChildCompletion(id);
  }

  static async getSubtasks(parentId: string): Promise<DatabaseTask[]> {
    const database = await getDatabase();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created FROM tasks WHERE parent_id = $1",
      [parentId]
    );
  }

  static async handleParentChildCompletion(taskId: string): Promise<void> {
    const database = await getDatabase();

    // Get the task that was just toggled
    const [task] = (await database.select(
      "SELECT id, parent_id, completed FROM tasks WHERE id = $1",
      [taskId]
    )) as DatabaseTask[];

    if (!task) return;

    // If task was completed, check if parent should be auto-completed
    if (Boolean(task.completed) && task.parent_id) {
      const siblings = await this.getSubtasks(task.parent_id);
      const allSiblingsCompleted = siblings.every((sibling) =>
        Boolean(sibling.completed)
      );

      if (allSiblingsCompleted) {
        // Auto-complete parent
        const now = new Date().toISOString();
        await database.execute(
          "UPDATE tasks SET completed = TRUE, completed_at = $1 WHERE id = $2",
          [now, task.parent_id]
        );
        // Recursively check parent's parent
        await this.handleParentChildCompletion(task.parent_id);
      }
    }
    // If task was uncompleted, auto-uncomplete parent if it was completed
    else if (!Boolean(task.completed) && task.parent_id) {
      const [parent] = (await database.select(
        "SELECT id, completed, parent_id FROM tasks WHERE id = $1",
        [task.parent_id]
      )) as DatabaseTask[];

      if (parent && Boolean(parent.completed)) {
        // Auto-uncomplete parent
        await database.execute(
          "UPDATE tasks SET completed = FALSE, completed_at = NULL WHERE id = $1",
          [task.parent_id]
        );
        // Recursively check parent's parent
        if (parent.parent_id) {
          await this.handleParentChildCompletion(task.parent_id);
        }
      }
    }
  }
}
