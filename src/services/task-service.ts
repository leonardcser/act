import { Task, DateFilter } from "../types";
import { DatabaseService, DatabaseTask } from "./database";
import {
  generateDateFilters,
  generateDateFiltersFromDates,
} from "../utils/date";
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
      completedSubtasks: dbTask.completed_subtasks || 0,
    };
  }

  private static async getAllTasks(): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    return await database.select(`
      WITH RECURSIVE subtask_counts AS (
        SELECT 
          t.id,
          COUNT(s.id) as total_subtasks,
          SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) as completed_subtasks
        FROM tasks t
        LEFT JOIN tasks s ON s.parent_id = t.id
        GROUP BY t.id
      )
      SELECT 
        t.id, 
        t.name, 
        t.parent_id, 
        t.completed, 
        t.completed_at, 
        t.date_created, 
        t.task_order,
        COALESCE(sc.completed_subtasks, 0) as completed_subtasks
      FROM tasks t
      LEFT JOIN subtask_counts sc ON t.id = sc.id
      ORDER BY t.parent_id, t.task_order ASC
    `);
  }

  private static async getTasksByDate(
    startDate: string,
    endDate: string
  ): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    return await database.select(
      `
      WITH RECURSIVE subtask_counts AS (
        SELECT 
          t.id,
          COUNT(s.id) as total_subtasks,
          SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) as completed_subtasks
        FROM tasks t
        LEFT JOIN tasks s ON s.parent_id = t.id
        GROUP BY t.id
      )
      SELECT 
        t.id, 
        t.name, 
        t.parent_id, 
        t.completed, 
        t.completed_at, 
        t.date_created, 
        t.task_order,
        COALESCE(sc.completed_subtasks, 0) as completed_subtasks
      FROM tasks t
      LEFT JOIN subtask_counts sc ON t.id = sc.id
      WHERE t.date_created >= $1 AND t.date_created <= $2
      ORDER BY t.parent_id, t.task_order ASC
    `,
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
      `
      WITH RECURSIVE subtask_counts AS (
        SELECT 
          t.id,
          COUNT(s.id) as total_subtasks,
          SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) as completed_subtasks
        FROM tasks t
        LEFT JOIN tasks s ON s.parent_id = t.id
        GROUP BY t.id
      )
      SELECT 
        t.id, 
        t.name, 
        t.parent_id, 
        t.completed, 
        t.completed_at, 
        t.date_created, 
        t.task_order,
        COALESCE(sc.completed_subtasks, 0) as completed_subtasks
      FROM tasks t
      LEFT JOIN subtask_counts sc ON t.id = sc.id
      WHERE t.parent_id = $1
      ORDER BY t.task_order ASC
    `,
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
        case "tomorrow":
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dbTasks = await this.getTasksForDate(tomorrow);
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

  static async createTask(
    name: string,
    parentId?: string,
    date?: Date
  ): Promise<Task> {
    const database = await DatabaseService.getConnection();
    const taskDate = date ? date.toISOString() : new Date().toISOString();
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
      date_created: taskDate,
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

    if (idsArray.length === 0) return;

    // Get all tasks being deleted to check their parents
    const tasksToDelete = (await database.select(
      `SELECT id, parent_id, completed FROM tasks WHERE id IN (${idsArray
        .map(() => "?")
        .join(", ")})`,
      idsArray
    )) as DatabaseTask[];

    if (tasksToDelete.length === 0) return;

    // Delete all tasks and their subtasks in one query
    await database.execute(
      `DELETE FROM tasks WHERE id IN (${idsArray
        .map(() => "?")
        .join(", ")}) OR parent_id IN (${idsArray.map(() => "?").join(", ")})`,
      [...idsArray, ...idsArray]
    );

    // Handle parent-child completion logic for affected parents
    const uniqueParents = new Set(
      tasksToDelete
        .map((task) => task.parent_id)
        .filter((id): id is string => Boolean(id))
    );

    for (const parentId of uniqueParents) {
      // Check remaining siblings after deletion
      const siblings = await this.getSubtasks(parentId);

      if (siblings.length > 0) {
        const allSiblingsCompleted = siblings.every((sibling) =>
          Boolean(sibling.completed)
        );

        if (allSiblingsCompleted) {
          // Auto-complete parent
          const now = new Date().toISOString();
          await database.execute(
            "UPDATE tasks SET completed = TRUE, completed_at = $1 WHERE id = $2",
            [now, parentId]
          );
          // Recursively check parent's parent
          await this.handleParentChildCompletion(parentId);
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

    if (taskIds.length === 0) return;

    // Build CASE statement for updating order in a single query
    const caseClauses = taskIds
      .map((_, index) => `WHEN id = ? THEN ${index}`)
      .join(" ");
    const placeholders = taskIds.map(() => "?").join(", ");

    await database.execute(
      `UPDATE tasks SET task_order = CASE ${caseClauses} END WHERE id IN (${placeholders}) AND parent_id IS ?`,
      [...taskIds, ...taskIds, parentId || null]
    );
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

    if (idsArray.length === 0) return;

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

    // Build CASE statement for updating task_order in a single query
    const orderCaseClauses = tasksToMove
      .map((_, index) => `WHEN id = ? THEN ${max_order + 1 + index}`)
      .join(" ");
    const placeholders = idsArray.map(() => "?").join(", ");

    // Update all tasks' parent_id and task_order in one query
    await database.execute(
      `UPDATE tasks SET parent_id = ?, task_order = CASE ${orderCaseClauses} END WHERE id IN (${placeholders})`,
      [newParentId || null, ...idsArray, ...idsArray]
    );

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

  static async generateDateFiltersFromDatabase(): Promise<DateFilter[]> {
    const distinctDates = await this.getAllDistinctDates();
    const uncompletedCounts = await this.getUncompletedTaskCountsByDate();
    return generateDateFiltersFromDates(distinctDates, uncompletedCounts);
  }

  static async updateTasksDates(
    taskIds: string | string[],
    newDate: Date
  ): Promise<void> {
    const database = await DatabaseService.getConnection();
    const dateStr = newDate.toISOString();

    // Normalize to array
    const idsArray = Array.isArray(taskIds) ? taskIds : [taskIds];

    if (idsArray.length === 0) return;

    // Update all specified tasks in one query
    const placeholders = idsArray.map(() => "?").join(", ");
    await database.execute(
      `UPDATE tasks SET date_created = ? WHERE id IN (${placeholders})`,
      [dateStr, ...idsArray]
    );

    // Get all subtasks recursively for all tasks and update their dates too
    const allSubtaskIds: string[] = [];
    for (const taskId of idsArray) {
      const subtasks = await this.getAllSubtasksRecursive(taskId);
      allSubtaskIds.push(...subtasks.map((task) => task.id));
    }

    // Update all subtasks in one query if there are any
    if (allSubtaskIds.length > 0) {
      const subtaskPlaceholders = allSubtaskIds.map(() => "?").join(", ");
      await database.execute(
        `UPDATE tasks SET date_created = ? WHERE id IN (${subtaskPlaceholders})`,
        [dateStr, ...allSubtaskIds]
      );
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

  static async getAllDistinctDates(): Promise<Date[]> {
    const database = await DatabaseService.getConnection();

    // Get all distinct created dates
    const dateRows = (await database.select(
      `SELECT DISTINCT DATE(date_created) as date_str FROM tasks
       ORDER BY date_str DESC`
    )) as Array<{ date_str: string }>;

    return dateRows.map((row) => new Date(row.date_str + "T00:00:00.000Z"));
  }

  static async getUncompletedTaskCountsByDate(): Promise<Map<string, number>> {
    const database = await DatabaseService.getConnection();
    const rows = (await database.select(
      `SELECT DATE(date_created) as date_str, COUNT(id) as count FROM tasks WHERE completed = 0 GROUP BY date_str`
    )) as Array<{ date_str: string; count: number }>;

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.date_str, row.count);
    }
    return counts;
  }
}
