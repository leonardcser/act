export interface Task {
  id: string;
  name: string;
  parentId?: string;
  completed: boolean;
  completedAt?: Date;
  dateCreated: Date;
  order: number;
}

export interface Column {
  parentTaskId?: string;
  level: number;
}

export interface DateFilter {
  type: "today" | "tomorrow" | "yesterday" | "date" | "range";
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  label: string;
}
