import Database from "@tauri-apps/plugin-sql";
import { homeDir } from "@tauri-apps/api/path";

export interface DatabaseTask {
  id: string;
  name: string;
  parent_id?: string;
  completed: number; // 0 for false, 1 for true in sqlite
  completed_at?: string;
  created_at: string;
  due_date: string;
  task_order: number;
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
  /**
   * Get the database connection instance
   */
  static async getConnection(): Promise<Database> {
    return await getDatabase();
  }

  /**
   * Close the database connection
   */
  static async close(): Promise<void> {
    if (db) {
      await db.close();
      db = null;
    }
  }
}
