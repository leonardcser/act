import React from "react";
import { cn } from "../utils";
import { Task, Column } from "../types";
import { TaskItem } from "./task-item";

interface TaskColumnProps {
  column: Column;
  columnIndex: number;
  tasks: Task[];
  selectedTasks: Set<string>;
  selectedColumn: number;
  focusedColumn: number;
  isTaskOpen: (taskId: string) => boolean;
  getSubtaskCount: (taskId: string) => number;
  onColumnClick: (columnIndex: number, e: React.MouseEvent) => void;
  onTaskClick: (task: Task, columnIndex: number, e: React.MouseEvent) => void;
  onTaskUpdate: (task: Task, newName: string) => void;
}

export function TaskColumn({
  column,
  columnIndex,
  tasks,
  selectedTasks,
  selectedColumn,
  isTaskOpen,
  getSubtaskCount,
  onColumnClick,
  onTaskClick,
  onTaskUpdate,
}: TaskColumnProps) {
  const isColumnSelected =
    selectedColumn === columnIndex && selectedTasks.size === 0;

  return (
    <div
      key={`${column.level}-${column.parentTaskId || "root"}`}
      className={cn(
        "flex-shrink-0 w-80 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-colors",
        isColumnSelected && "bg-neutral-50 dark:bg-neutral-800/60"
      )}
      onClick={(e) => onColumnClick(columnIndex, e)}
    >
      <div
        className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800"
        onClick={(e) => onColumnClick(columnIndex, e)}
      >
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            columnIndex={columnIndex}
            isSelected={selectedTasks.has(task.id)}
            isOpen={isTaskOpen(task.id)}
            subtaskCount={getSubtaskCount(task.id)}
            onTaskClick={onTaskClick}
            onTaskUpdate={onTaskUpdate}
          />
        ))}

        {tasks.length === 0 && (
          <div
            className="text-center py-8 text-neutral-400 dark:text-neutral-500 text-sm cursor-default select-none"
            onClick={(e) => onColumnClick(columnIndex, e)}
          >
            No tasks yet.
          </div>
        )}
      </div>
    </div>
  );
}
