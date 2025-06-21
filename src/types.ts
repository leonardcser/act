export interface Task {
  id: string;
  name: string;
  parentId?: string;
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
  dueDate: Date;
  order: number;
  completedSubtasks: number;
  totalSubtasks: number;
}

export interface Column {
  parentTaskId?: string;
  level: number;
}

export interface DateFilter {
  type: "all" | "today" | "tomorrow" | "yesterday" | "date" | "range";
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  label: string;
  totalTaskCount?: number;
  completedTaskCount?: number;
}
