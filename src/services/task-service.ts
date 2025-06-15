import { Task, DateFilter } from "../types";
import { DatabaseService, DatabaseTask } from "./database";
import { generateDateFilters } from "../utils/date";
import { v4 as uuidv4 } from "uuid";

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

  private static async getTodaysTasks(): Promise<DatabaseTask[]> {
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;
    return await this.getTasksByDate(startOfDay, endOfDay);
  }

  private static async getTasksForDate(date: Date): Promise<DatabaseTask[]> {
    const dateStr = date.toISOString().split("T")[0];
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;
    return await this.getTasksByDate(startOfDay, endOfDay);
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

  static async deleteTasks(taskIds: string | string[]): Promise<void> {
    const database = await DatabaseService.getConnection();

    // Normalize to array
    const idsArray = Array.isArray(taskIds) ? taskIds : [taskIds];

    // Process each task for deletion
    for (const id of idsArray) {
      // Get the task being deleted to check if it has a parent
      const [taskToDelete] = (await database.select(
        "SELECT id, parent_id, completed FROM tasks WHERE id = $1",
        [id]
      )) as DatabaseTask[];

      if (!taskToDelete) continue; // Skip if task doesn't exist

      // Delete the task and all its subtasks
      await database.execute(
        "DELETE FROM tasks WHERE id = $1 OR parent_id = $1",
        [id]
      );

      // Handle parent-child completion logic
      // If the deleted task had a parent, check if parent should be auto-completed
      if (taskToDelete.parent_id) {
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

  private static async updateParentCompletionStatus(
    parentId: string
  ): Promise<void> {
    const database = await DatabaseService.getConnection();

    // Get all children of this parent
    const children = await this.getSubtasks(parentId);

    if (children.length === 0) return;

    const allChildrenCompleted = children.every((child) =>
      Boolean(child.completed)
    );

    // Get current parent status
    const [parent] = (await database.select(
      "SELECT id, completed, parent_id FROM tasks WHERE id = $1",
      [parentId]
    )) as DatabaseTask[];

    if (!parent) return;

    // Update parent completion status if needed
    if (allChildrenCompleted && !Boolean(parent.completed)) {
      // Auto-complete parent
      const now = new Date().toISOString();
      await database.execute(
        "UPDATE tasks SET completed = TRUE, completed_at = $1 WHERE id = $2",
        [now, parentId]
      );
      // Recursively check parent's parent
      if (parent.parent_id) {
        await this.updateParentCompletionStatus(parent.parent_id);
      }
    } else if (!allChildrenCompleted && Boolean(parent.completed)) {
      // Auto-uncomplete parent
      await database.execute(
        "UPDATE tasks SET completed = FALSE, completed_at = NULL WHERE id = $1",
        [parentId]
      );
      // Recursively check parent's parent
      if (parent.parent_id) {
        await this.updateParentCompletionStatus(parent.parent_id);
      }
    }
  }

  static async moveTasksToParent(
    taskIds: string | string[],
    newParentId?: string
  ): Promise<void> {
    const database = await DatabaseService.getConnection();

    // Normalize to array
    const idsArray = Array.isArray(taskIds) ? taskIds : [taskIds];

    // Get the tasks being moved to check their current parents
    const tasksToMove = (await database.select(
      `SELECT id, parent_id, completed FROM tasks WHERE id IN (${idsArray
        .map(() => "?")
        .join(", ")})`,
      idsArray
    )) as DatabaseTask[];

    if (tasksToMove.length === 0) return;

    // Get the next order number for the new parent
    const [{ max_order }] = (await database.select(
      "SELECT COALESCE(MAX(task_order), -1) as max_order FROM tasks WHERE parent_id IS $1",
      [newParentId || null]
    )) as [{ max_order: number }];

    // Update all tasks' parent_id and set them to consecutive orders
    for (let i = 0; i < tasksToMove.length; i++) {
      const task = tasksToMove[i];
      await database.execute(
        "UPDATE tasks SET parent_id = $1, task_order = $2 WHERE id = $3",
        [newParentId || null, max_order + 1 + i, task.id]
      );
    }

    // Handle parent-child completion logic for both old and new parents
    const uniqueOldParents = new Set(
      tasksToMove
        .map((task) => task.parent_id)
        .filter((id): id is string => Boolean(id))
    );

    for (const oldParentId of uniqueOldParents) {
      // Check if old parent should be auto-completed/uncompleted after losing children
      await this.updateParentCompletionStatus(oldParentId);
    }

    if (newParentId) {
      // Check if new parent should be auto-completed/uncompleted after gaining children
      await this.updateParentCompletionStatus(newParentId);
    }
  }

  static generateDateFilters(tasks: Task[]): DateFilter[] {
    return generateDateFilters(tasks);
  }

  static async updateTasksDates(
    taskIds: string | string[],
    newDate: Date
  ): Promise<void> {
    const database = await DatabaseService.getConnection();
    const dateStr = newDate.toISOString();

    // Normalize to array
    const idsArray = Array.isArray(taskIds) ? taskIds : [taskIds];

    // Update all specified tasks
    for (const taskId of idsArray) {
      await database.execute(
        "UPDATE tasks SET date_created = $1 WHERE id = $2",
        [dateStr, taskId]
      );

      // Get all subtasks recursively and update their dates too
      const allSubtasks = await this.getAllSubtasksRecursive(taskId);

      for (const subtask of allSubtasks) {
        await database.execute(
          "UPDATE tasks SET date_created = $1 WHERE id = $2",
          [dateStr, subtask.id]
        );
      }
    }
  }

  private static async getAllSubtasksRecursive(
    taskId: string
  ): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    const directSubtasks = (await database.select(
      "SELECT id, name, parent_id, completed, completed_at, date_created, task_order FROM tasks WHERE parent_id = $1",
      [taskId]
    )) as DatabaseTask[];

    const allSubtasks = [...directSubtasks];

    // Recursively get subtasks of subtasks
    for (const subtask of directSubtasks) {
      const nestedSubtasks = await this.getAllSubtasksRecursive(subtask.id);
      allSubtasks.push(...nestedSubtasks);
    }

    return allSubtasks;
  }
}
