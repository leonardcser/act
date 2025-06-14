import { Task, DateFilter } from "../types";
import { DatabaseService } from "./database";
import { generateDateFilters } from "../utils/date";

export class TaskService {
  private static sortTasks(tasks: Task[]): Task[] {
    return tasks.sort(
      (a, b) => a.dateCreated.getTime() - b.dateCreated.getTime()
    );
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
    };
  }

  static async loadTasks(dateFilter?: DateFilter): Promise<Task[]> {
    let dbTasks;

    if (!dateFilter) {
      dbTasks = await DatabaseService.getAllTasks();
    } else {
      switch (dateFilter.type) {
        case "today":
          dbTasks = await DatabaseService.getTodaysTasks();
          break;
        case "yesterday":
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          dbTasks = await DatabaseService.getTasksForDate(yesterday);
          break;
        case "date":
          if (dateFilter.date) {
            dbTasks = await DatabaseService.getTasksForDate(dateFilter.date);
          } else {
            dbTasks = await DatabaseService.getAllTasks();
          }
          break;
        case "range":
          if (dateFilter.startDate && dateFilter.endDate) {
            const startDateStr = dateFilter.startDate.toISOString();
            const endDateStr = dateFilter.endDate.toISOString();
            dbTasks = await DatabaseService.getTasksByDate(
              startDateStr,
              endDateStr
            );
          } else {
            dbTasks = await DatabaseService.getAllTasks();
          }
          break;
        default:
          dbTasks = await DatabaseService.getAllTasks();
      }
    }

    const convertedTasks = dbTasks.map(this.convertDatabaseTask);
    return this.sortTasks(convertedTasks);
  }

  static async createTask(name: string, parentId?: string): Promise<Task> {
    const dbTask = await DatabaseService.createTask(name, parentId);
    return this.convertDatabaseTask(dbTask);
  }

  static async updateTask(id: string, name: string): Promise<void> {
    await DatabaseService.updateTask(id, name);
  }

  static async deleteTask(id: string): Promise<void> {
    await DatabaseService.deleteTask(id);
  }

  static async toggleTask(id: string): Promise<void> {
    await DatabaseService.toggleTaskCompleted(id);
  }

  static getTasksByParentId(
    tasks: Task[],
    parentId?: string,
    showCompleted = true
  ): Task[] {
    return tasks
      .filter((task) => task.parentId === parentId)
      .filter((task) => showCompleted || !task.completed)
      .sort((a, b) => a.dateCreated.getTime() - b.dateCreated.getTime());
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

  static generateDateFilters(tasks: Task[]): DateFilter[] {
    return generateDateFilters(tasks);
  }
}
