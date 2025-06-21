import { Task, DateFilter } from "../types";
import { DatabaseService, DatabaseTask } from "./database";
import { generateDateFiltersFromDates } from "../utils/date";
import { v4 as uuidv4 } from "uuid";

export class TaskService {
  private static convertDatabaseTask(dbTask: any): Task {
    return {
      id: dbTask.id,
      name: dbTask.name,
      parentId: dbTask.parent_id || undefined,
      completed: Boolean(dbTask.completed),
      completedAt: dbTask.completed_at
        ? new Date(dbTask.completed_at)
        : undefined,
      createdAt: new Date(dbTask.created_at),
      dueDate: new Date(dbTask.due_date),
      order: dbTask.task_order,
      completedSubtasks: dbTask.completed_subtasks || 0,
    };
  }

  private static async getAllTasks(): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    const today = new Date().toISOString().split("T")[0];
    const startOfToday = `${today}T00:00:00.000Z`;

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
        t.created_at, 
        t.due_date,
        t.task_order,
        COALESCE(sc.completed_subtasks, 0) as completed_subtasks
      FROM tasks t
      LEFT JOIN subtask_counts sc ON t.id = sc.id
      ORDER BY 
        DATE(t.due_date) ASC,
        t.completed ASC,
        t.parent_id, 
        t.task_order ASC,
        t.created_at ASC
    `,
      [startOfToday]
    );
  }

  private static async getTasksByDate(
    startDate: string,
    endDate: string
  ): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    const today = new Date().toISOString().split("T")[0];
    const startOfToday = `${today}T00:00:00.000Z`;

    return await database.select(
      `
      WITH RECURSIVE 
      -- Find all tasks that match the date criteria
      matching_tasks AS (
        SELECT id, parent_id FROM tasks 
        WHERE due_date >= $1 AND due_date <= $2
      ),
      -- Recursively find all parent tasks
      parent_hierarchy AS (
        SELECT id, parent_id FROM matching_tasks
        UNION ALL
        SELECT t.id, t.parent_id FROM tasks t
        INNER JOIN parent_hierarchy ph ON t.id = ph.parent_id
      ),
      -- Calculate subtask counts for all relevant tasks
      subtask_counts AS (
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
        t.created_at, 
        t.due_date,
        t.task_order,
        COALESCE(sc.completed_subtasks, 0) as completed_subtasks
      FROM tasks t
      LEFT JOIN subtask_counts sc ON t.id = sc.id
      WHERE t.id IN (SELECT id FROM parent_hierarchy)
      ORDER BY 
        CASE WHEN t.due_date < $3 AND t.completed = 0 THEN 0 ELSE 1 END,
        t.parent_id, 
        t.task_order ASC,
        CASE WHEN t.due_date < $3 AND t.completed = 0 THEN t.due_date END DESC,
        t.created_at ASC
    `,
      [startDate, endDate, startOfToday]
    );
  }

  private static async getTodaysTasks(): Promise<DatabaseTask[]> {
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    // Get today's tasks and incomplete overdue tasks (due before today)
    const database = await DatabaseService.getConnection();
    return await database.select(
      `
      WITH RECURSIVE 
      -- Find all tasks that match the date criteria (today's tasks + overdue incomplete)
      matching_tasks AS (
        SELECT id, parent_id FROM tasks 
        WHERE (due_date >= $1 AND due_date <= $2) OR (due_date < $1 AND completed = 0)
      ),
      -- Recursively find all parent tasks
      parent_hierarchy AS (
        SELECT id, parent_id FROM matching_tasks
        UNION ALL
        SELECT t.id, t.parent_id FROM tasks t
        INNER JOIN parent_hierarchy ph ON t.id = ph.parent_id
      ),
      -- Calculate subtask counts for all relevant tasks
      subtask_counts AS (
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
        t.created_at, 
        t.due_date,
        t.task_order,
        COALESCE(sc.completed_subtasks, 0) as completed_subtasks
      FROM tasks t
      LEFT JOIN subtask_counts sc ON t.id = sc.id
      WHERE t.id IN (SELECT id FROM parent_hierarchy)
      ORDER BY 
        CASE WHEN t.due_date < $1 AND t.completed = 0 THEN 0 ELSE 1 END,
        t.parent_id, 
        t.task_order ASC,
        CASE WHEN t.due_date < $1 AND t.completed = 0 THEN t.due_date END DESC,
        t.created_at ASC
    `,
      [startOfDay, endOfDay]
    );
  }

  private static async getTasksForDate(date: Date): Promise<DatabaseTask[]> {
    const dateStr = date.toISOString().split("T")[0];
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;
    return await this.getTasksByDate(startOfDay, endOfDay);
  }

  private static async getTomorrowsTasks(): Promise<DatabaseTask[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const startOfDay = `${tomorrowStr}T00:00:00.000Z`;
    const endOfDay = `${tomorrowStr}T23:59:59.999Z`;

    // Get today's date for overdue cutoff
    const today = new Date().toISOString().split("T")[0];
    const startOfToday = `${today}T00:00:00.000Z`;

    // Get tomorrow's tasks and incomplete overdue tasks (due before today)
    const database = await DatabaseService.getConnection();
    return await database.select(
      `
      WITH RECURSIVE 
      -- Find all tasks that match the date criteria (tomorrow's tasks + overdue incomplete)
      matching_tasks AS (
        SELECT id, parent_id FROM tasks 
        WHERE (due_date >= $1 AND due_date <= $2) OR (due_date < $3 AND completed = 0)
      ),
      -- Recursively find all parent tasks
      parent_hierarchy AS (
        SELECT id, parent_id FROM matching_tasks
        UNION ALL
        SELECT t.id, t.parent_id FROM tasks t
        INNER JOIN parent_hierarchy ph ON t.id = ph.parent_id
      ),
      -- Calculate subtask counts for all relevant tasks
      subtask_counts AS (
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
        t.created_at, 
        t.due_date,
        t.task_order,
        COALESCE(sc.completed_subtasks, 0) as completed_subtasks
      FROM tasks t
      LEFT JOIN subtask_counts sc ON t.id = sc.id
      WHERE t.id IN (SELECT id FROM parent_hierarchy)
      ORDER BY 
        CASE WHEN t.due_date < $3 AND t.completed = 0 THEN 0 ELSE 1 END,
        t.parent_id, 
        t.task_order ASC,
        CASE WHEN t.due_date < $3 AND t.completed = 0 THEN t.due_date END DESC,
        t.created_at ASC
    `,
      [startOfDay, endOfDay, startOfToday]
    );
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
        t.created_at, 
        t.due_date,
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
        case "all":
          dbTasks = await this.getAllTasks();
          break;
        case "today":
          dbTasks = await this.getTodaysTasks();
          break;
        case "tomorrow":
          dbTasks = await this.getTomorrowsTasks();
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

    return dbTasks.map(this.convertDatabaseTask);
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
      created_at: new Date().toISOString(),
      due_date: taskDate,
      task_order: max_order + 1,
    };

    await database.execute(
      "INSERT INTO tasks (id, name, parent_id, completed, completed_at, created_at, due_date, task_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        task.id,
        task.name,
        task.parent_id,
        task.completed,
        task.completed_at,
        task.created_at,
        task.due_date,
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
    // Filter tasks by parent and completion status
    const filteredTasks = tasks
      .filter((task) => task.parentId === parentId)
      .filter((task) => showCompleted || !task.completed);

    // Preserve the original order from the tasks array instead of sorting by order
    // This maintains the overdue priority ordering from the database query
    return filteredTasks;
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

  static async generateDateFiltersFromDatabase(): Promise<DateFilter[]> {
    const distinctDates = await this.getAllDistinctDates();
    const taskCounts = await this.getTaskCountsByDate();
    return generateDateFiltersFromDates(distinctDates, taskCounts);
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
      `UPDATE tasks SET due_date = ? WHERE id IN (${placeholders})`,
      [dateStr, ...idsArray]
    );

    // Get all subtasks recursively for all tasks and update their dates too
    const allSubtaskIds: string[] = [];
    for (const taskId of idsArray) {
      const subtasks = await this.getAllSubtasksRecursive(taskId);
      allSubtaskIds.push(...subtasks.map((task) => task.id));
    }

    // Update only non-completed subtasks in one query if there are any
    if (allSubtaskIds.length > 0) {
      const subtaskPlaceholders = allSubtaskIds.map(() => "?").join(", ");
      await database.execute(
        `UPDATE tasks SET due_date = ? WHERE id IN (${subtaskPlaceholders}) AND completed = 0`,
        [dateStr, ...allSubtaskIds]
      );
    }
  }

  private static async getAllSubtasksRecursive(
    taskId: string
  ): Promise<DatabaseTask[]> {
    const database = await DatabaseService.getConnection();
    const directSubtasks = (await database.select(
      "SELECT id, name, parent_id, completed, completed_at, created_at, due_date, task_order FROM tasks WHERE parent_id = $1",
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

    // Get all distinct due dates
    const dateRows = (await database.select(
      `SELECT DISTINCT DATE(due_date) as date_str FROM tasks
       ORDER BY date_str DESC`
    )) as Array<{ date_str: string }>;

    return dateRows.map((row) => new Date(row.date_str + "T00:00:00.000Z"));
  }

  static async getTaskCountsByDate(): Promise<
    Map<string, { total: number; completed: number }>
  > {
    const database = await DatabaseService.getConnection();
    const rows = (await database.select(
      `SELECT 
        DATE(due_date) as date_str, 
        COUNT(id) as total_count,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_count
       FROM tasks 
       GROUP BY date_str`
    )) as Array<{
      date_str: string;
      total_count: number;
      completed_count: number;
    }>;

    const counts = new Map<string, { total: number; completed: number }>();
    for (const row of rows) {
      counts.set(row.date_str, {
        total: row.total_count,
        completed: row.completed_count,
      });
    }
    return counts;
  }
}
