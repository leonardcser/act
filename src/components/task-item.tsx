import React from "react";
import { Folder } from "lucide-react";
import { cn } from "../utils";
import { Task } from "../types";

interface TaskItemProps {
  task: Task;
  columnIndex: number;
  isSelected: boolean;
  isOpen: boolean;
  subtaskCount: number;
  selectedTasks: Set<string>;
  openTaskIds: Set<string>;
  onTaskClick: (task: Task, columnIndex: number, e: React.MouseEvent) => void;
  onTaskUpdate: (task: Task, newName: string) => void;
  onTaskDrop: (draggedTaskIds: string[], targetTaskId: string) => void;
  getAllSubtasks: (taskId: string) => Task[];
}

export function TaskItem({
  task,
  columnIndex,
  isSelected,
  isOpen,
  subtaskCount,
  selectedTasks,
  openTaskIds,
  onTaskClick,
  onTaskUpdate,
  onTaskDrop,
  getAllSubtasks,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(task.name);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isCompleted = task.completed;

  React.useEffect(() => {
    setInputValue(task.name);
  }, [task.name]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleInputBlur = () => {
    setIsEditing(false);
    if (inputValue.trim() !== task.name && inputValue.trim() !== "") {
      onTaskUpdate(task, inputValue.trim());
    } else {
      setInputValue(task.name);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    // Stop all event propagation when editing to prevent navigation
    e.stopPropagation();

    if (e.key === "Enter") {
      e.preventDefault();
      handleInputBlur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputValue(task.name);
      setIsEditing(false);
    }
  };

  const handleTaskNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  // Check if dragging a task to target would create a cycle
  const wouldCreateCycle = (
    draggedTaskId: string,
    targetTaskId: string
  ): boolean => {
    if (draggedTaskId === targetTaskId) return true;

    // Check if target is a descendant of the dragged task
    const allSubtasks = getAllSubtasks(draggedTaskId);
    return allSubtasks.some((subtask) => subtask.id === targetTaskId);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isEditing) {
      e.preventDefault();
      return;
    }

    // If this task is selected, drag all selected tasks
    // Otherwise, just drag this task
    const tasksToDrag = selectedTasks.has(task.id)
      ? Array.from(selectedTasks)
      : [task.id];

    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "tasks",
        taskIds: tasksToDrag,
        sourceColumnIndex: columnIndex,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
      if (data.type === "tasks" && data.taskIds) {
        // Check if we can drop here
        const canDrop =
          !data.taskIds.includes(task.id) &&
          !data.taskIds.some((taskId: string) =>
            wouldCreateCycle(taskId, task.id)
          );

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
      if (data.type === "tasks" && data.taskIds) {
        // Validate the drop
        const canDrop =
          !data.taskIds.includes(task.id) &&
          !data.taskIds.some((taskId: string) =>
            wouldCreateCycle(taskId, task.id)
          );

        if (canDrop) {
          onTaskDrop(data.taskIds, task.id);
        }
      }
    } catch (error) {
      console.error("Failed to handle drop:", error);
    }
  };

  return (
    <div
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => onTaskClick(task, columnIndex, e)}
      className={cn(
        "group flex items-center justify-between gap-2 p-3 transition-all duration-300 cursor-pointer",
        isCompleted
          ? isSelected
            ? "bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/40"
            : "hover:bg-green-50 dark:hover:bg-green-800/30 opacity-50"
          : isSelected
          ? "bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40"
          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
        isDragOver &&
          "ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20",
        !isEditing && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className={cn("flex items-center gap-3", isEditing && "flex-1")}>
        <div
          className={cn(
            "transition-colors",
            isCompleted
              ? "text-green-500 dark:text-green-400"
              : isSelected
              ? "text-blue-600 dark:text-blue-400"
              : isOpen
              ? "text-neutral-400 dark:text-neutral-500"
              : "text-neutral-200 dark:text-neutral-600"
          )}
        >
          <Folder size={16} />
        </div>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onClick={handleTaskNameClick}
          size={isEditing ? undefined : Math.max(inputValue.length + 1, 1)}
          className={cn(
            "text-sm font-medium transition-all duration-300 bg-transparent border-none outline-none cursor-text",
            isEditing ? "flex-1" : "w-fit",
            isCompleted
              ? isSelected
                ? "line-through text-green-900 dark:text-green-100"
                : "line-through text-neutral-500 dark:text-neutral-400"
              : isSelected
              ? "text-blue-900 dark:text-blue-100"
              : isOpen
              ? "text-neutral-800 dark:text-neutral-200"
              : "text-neutral-400 dark:text-neutral-500",
            isEditing &&
              "ring-1 ring-blue-300 dark:ring-blue-600 rounded px-1 bg-white dark:bg-neutral-800"
          )}
          readOnly={!isEditing}
        />
      </div>
      <div className="flex items-center gap-2">
        {subtaskCount > 0 && (
          <div
            className={cn(
              "grid place-items-center text-xs font-bold size-5 rounded-full transition-colors",
              isCompleted
                ? "text-green-600 dark:text-green-400"
                : isSelected
                ? "text-blue-700 dark:text-blue-300"
                : isOpen
                ? "text-neutral-700 dark:text-neutral-300"
                : "text-neutral-500 dark:text-neutral-400"
            )}
          >
            <span>{subtaskCount}</span>
          </div>
        )}
        {isCompleted && (
          <div className="text-green-500 dark:text-green-400 text-xs">✓</div>
        )}
      </div>
    </div>
  );
}
