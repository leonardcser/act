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
  getAllSubtasks: (taskId: string) => Task[];
  onColumnClick: (columnIndex: number, e: React.MouseEvent) => void;
  onTaskClick: (task: Task, columnIndex: number, e: React.MouseEvent) => void;
  onTaskUpdate: (task: Task, newName: string) => void;
  onTaskToggle: (taskId: string) => void;
  onTaskDrop: (draggedTaskIds: string[], targetTaskId: string) => void;
  onColumnDrop: (draggedTaskIds: string[], targetColumnIndex: number) => void;
}

export function TaskColumn({
  column,
  columnIndex,
  tasks,
  selectedTasks,
  selectedColumn,
  isTaskOpen,
  getSubtaskCount,
  getAllSubtasks,
  onColumnClick,
  onTaskClick,
  onTaskUpdate,
  onTaskToggle,
  onTaskDrop,
  onColumnDrop,
}: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const isColumnSelected =
    selectedColumn === columnIndex && selectedTasks.size === 0;

  // Get all open task IDs for cycle detection
  const openTaskIds = React.useMemo(() => {
    const openIds = new Set<string>();
    tasks.forEach((task) => {
      if (isTaskOpen(task.id)) {
        openIds.add(task.id);
        // Add all subtasks of open tasks
        const subtasks = getAllSubtasks(task.id);
        subtasks.forEach((subtask) => openIds.add(subtask.id));
      }
    });
    return openIds;
  }, [tasks, isTaskOpen, getAllSubtasks]);

  // Check if dropping tasks into this column would create a cycle
  const wouldCreateCycleInColumn = (draggedTaskIds: string[]): boolean => {
    // If this column represents subtasks of a task, check for cycles
    if (column.parentTaskId) {
      return draggedTaskIds.some((draggedTaskId) => {
        // Direct cycle: dragging a task into its own subtask column
        if (draggedTaskId === column.parentTaskId) {
          return true;
        }

        // Indirect cycle: check if the column's parent would become a descendant of the dragged task
        const allSubtasks = getAllSubtasks(draggedTaskId);
        return allSubtasks.some(
          (subtask) => subtask.id === column.parentTaskId
        );
      });
    }
    return false;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
      if (
        data.type === "tasks" &&
        data.taskIds &&
        Array.isArray(data.taskIds)
      ) {
        // Check if we can drop here
        const canDrop =
          data.sourceColumnIndex !== columnIndex &&
          !wouldCreateCycleInColumn(data.taskIds);

        if (canDrop) {
          e.dataTransfer.dropEffect = "move";
          setIsDragOver(true);
        } else {
          e.dataTransfer.dropEffect = "none";
        }
      }
    } catch {
      e.dataTransfer.dropEffect = "none";
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only remove drag over state if we're actually leaving this element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (
        data.type === "tasks" &&
        data.taskIds &&
        Array.isArray(data.taskIds)
      ) {
        // Validate the drop
        const canDrop =
          data.sourceColumnIndex !== columnIndex &&
          !wouldCreateCycleInColumn(data.taskIds);

        if (canDrop) {
          onColumnDrop(data.taskIds, columnIndex);
        }
      }
    } catch (error) {
      console.error("Failed to handle column drop:", error);
    }
  };

  return (
    <div
      key={`${column.level}-${column.parentTaskId || "root"}`}
      className={cn(
        "flex-shrink-0 w-80 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-colors",
        isColumnSelected && "bg-neutral-50 dark:bg-neutral-800/60",
        isDragOver &&
          "ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50/30 dark:bg-blue-900/20"
      )}
      onClick={(e) => onColumnClick(columnIndex, e)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
            selectedTasks={selectedTasks}
            openTaskIds={openTaskIds}
            onTaskClick={onTaskClick}
            onTaskUpdate={onTaskUpdate}
            onTaskToggle={onTaskToggle}
            onTaskDrop={onTaskDrop}
            getAllSubtasks={getAllSubtasks}
          />
        ))}

        {tasks.length === 0 && (
          <div
            className={cn(
              "text-center py-8 text-neutral-400 dark:text-neutral-500 text-sm cursor-default select-none",
              isDragOver && "text-blue-500 dark:text-blue-400"
            )}
            onClick={(e) => onColumnClick(columnIndex, e)}
          >
            {isDragOver ? "Drop tasks here" : "No tasks yet."}
          </div>
        )}
      </div>
    </div>
  );
}
