export interface Task {
  id: string;
  name: string;
  parentId?: string;
  completed: boolean;
  completedAt?: Date;
  dateCreated: Date;
}

export interface Column {
  parentTaskId?: string;
  level: number;
}

export interface DateFilter {
  type: "today" | "yesterday" | "date" | "range";
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  label: string;
}
