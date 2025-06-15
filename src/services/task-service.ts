import { Task, DateFilter } from "../types";
import { DatabaseService, DatabaseTask } from "./database";
import { generateDateFilters } from "../utils/date";
import { v4 as uuidv4 } from "uuid";
import Database from "@tauri-apps/plugin-sql";

export class TaskService {
  private static sortTasks(tasks: Task[]): Task[] {
    return tasks.sort((a, b) => a.order - b.order);
  }

  private static convertDatabaseTask(dbTask: any): Task {
    return {
      id: dbTask.id,
      name: dbTask.name,
      parentId: dbTask.parent_id || undefined,
      completed: Boolean(dbTask.completed),
      completedAt: dbTask.completed_at
        ? new Date(dbTask.completed_at)
        : undefined,
      dateCreated: new Date(dbTask.date_created),
      order: dbTask.task_order,
    };
  }

  private static async getAllTasks(): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created, task_order FROM tasks ORDER BY parent_id, task_order ASC"
    );
  }

  private static async getTasksByDate(
    startDate: string,
    endDate: string
  ): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created, task_order FROM tasks WHERE date_created >= $1 AND date_created <= $2 ORDER BY parent_id, task_order ASC",
      [startDate, endDate]
    );
  }

  private static async getTasksByStatus(
    completed: boolean
  ): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created, task_order FROM tasks WHERE completed = $1 ORDER BY parent_id, task_order ASC",
      [completed]
    );
  }

  private static async getTasksByDateAndStatus(
    startDate: string,
    endDate: string,
    completed: boolean
  ): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created, task_order FROM tasks WHERE date_created >= $1 AND date_created <= $2 AND completed = $3 ORDER BY parent_id, task_order ASC",
      [startDate, endDate, completed]
    );
  }

  private static async getTodaysTasks(): Promise<DatabaseTask[]> {
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;
    return await this.getTasksByDate(startOfDay, endOfDay);
  }

  private static async getTodaysCompletedTasks(): Promise<DatabaseTask[]> {
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;
    return await this.getTasksByDateAndStatus(startOfDay, endOfDay, true);
  }

  private static async getTodaysPendingTasks(): Promise<DatabaseTask[]> {
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;
    return await this.getTasksByDateAndStatus(startOfDay, endOfDay, false);
  }

  private static async getTasksForDate(date: Date): Promise<DatabaseTask[]> {
    const dateStr = date.toISOString().split("T")[0];
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;
    return await this.getTasksByDate(startOfDay, endOfDay);
  }

  private static async getCompletedTasks(): Promise<DatabaseTask[]> {
    return await this.getTasksByStatus(true);
  }

  private static async getPendingTasks(): Promise<DatabaseTask[]> {
    return await this.getTasksByStatus(false);
  }

  private static async getSubtasks(parentId: string): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    return await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created, task_order FROM tasks WHERE parent_id = $1 ORDER BY task_order ASC",
      [parentId]
    );
  }

  private static async handleParentChildCompletion(
    taskId: string
  ): Promise<void> {
    const database = await DatabaseService.getConnection();

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

  static async loadTasks(dateFilter?: DateFilter): Promise<Task[]> {
    let dbTasks;

    if (!dateFilter) {
      dbTasks = await this.getAllTasks();
    } else {
      switch (dateFilter.type) {
        case "today":
          dbTasks = await this.getTodaysTasks();
          break;
        case "yesterday":
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          dbTasks = await this.getTasksForDate(yesterday);
          break;
        case "date":
          if (dateFilter.date) {
            dbTasks = await this.getTasksForDate(dateFilter.date);
          } else {
            dbTasks = await this.getAllTasks();
          }
          break;
        case "range":
          if (dateFilter.startDate && dateFilter.endDate) {
            const startDateStr = dateFilter.startDate.toISOString();
            const endDateStr = dateFilter.endDate.toISOString();
            dbTasks = await this.getTasksByDate(startDateStr, endDateStr);
          } else {
            dbTasks = await this.getAllTasks();
          }
          break;
        default:
          dbTasks = await this.getAllTasks();
      }
    }

    const convertedTasks = dbTasks.map(this.convertDatabaseTask);
    return this.sortTasks(convertedTasks);
  }

  static async createTask(name: string, parentId?: string): Promise<Task> {
    const database = await DatabaseService.getConnection();
    const now = new Date().toISOString();
    const id = uuidv4();

    // Get the next order number for this parent
    const [{ max_order }] = (await database.select(
      "SELECT COALESCE(MAX(task_order), -1) as max_order FROM tasks WHERE parent_id IS $1",
      [parentId || null]
    )) as [{ max_order: number }];

    const task: DatabaseTask = {
      id,
      name,
      parent_id: parentId,
      completed: 0,
      completed_at: undefined,
      date_created: now,
      task_order: max_order + 1,
    };

    await database.execute(
      "INSERT INTO tasks (id, name, parent_id, completed, completed_at, date_created, task_order) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        task.id,
        task.name,
        task.parent_id,
        task.completed,
        task.completed_at,
        task.date_created,
        task.task_order,
      ]
    );

    // Handle parent-child completion logic
    // New task is uncompleted, so if parent was completed, it should become uncompleted
    if (parentId) {
      await this.handleParentChildCompletion(id);
    }

    return this.convertDatabaseTask(task);
  }

  static async updateTask(id: string, name: string): Promise<void> {
    const database = await DatabaseService.getConnection();
    await database.execute("UPDATE tasks SET name = $1 WHERE id = $2", [
      name,
      id,
    ]);
  }

  static async deleteTask(id: string): Promise<void> {
    const database = await DatabaseService.getConnection();

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

  static async toggleTask(id: string): Promise<void> {
    const database = await DatabaseService.getConnection();
    const now = new Date().toISOString();

    await database.execute(
      "UPDATE tasks SET completed = NOT completed, completed_at = CASE WHEN completed THEN NULL ELSE $1 END WHERE id = $2",
      [now, id]
    );

    // Handle parent-child completion logic
    await this.handleParentChildCompletion(id);
  }

  static getTasksByParentId(
    tasks: Task[],
    parentId?: string,
    showCompleted = true
  ): Task[] {
    return tasks
      .filter((task) => task.parentId === parentId)
      .filter((task) => showCompleted || !task.completed)
      .sort((a, b) => a.order - b.order);
  }

  static getTaskById(tasks: Task[], id: string): Task | undefined {
    return tasks.find((task) => task.id === id);
  }

  static getAllSubtasks(tasks: Task[], taskId: string): Task[] {
    const directSubtasks = tasks.filter((task) => task.parentId === taskId);
    const allSubtasks = [...directSubtasks];

    for (const subtask of directSubtasks) {
      allSubtasks.push(...this.getAllSubtasks(tasks, subtask.id));
    }

    return allSubtasks;
  }

  static getSubtaskCount(tasks: Task[], taskId: string): number {
    return tasks.filter((task) => task.parentId === taskId).length;
  }

  static async reorderTasks(
    taskIds: string[],
    parentId?: string
  ): Promise<void> {
    const database = await DatabaseService.getConnection();

    // Update the order of tasks in the specified parent
    for (let i = 0; i < taskIds.length; i++) {
      await database.execute(
        "UPDATE tasks SET task_order = $1 WHERE id = $2 AND parent_id IS $3",
        [i, taskIds[i], parentId || null]
      );
    }
  }

  static generateDateFilters(tasks: Task[]): DateFilter[] {
    return generateDateFilters(tasks);
  }
}
