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
  onTaskClick: (task: Task, columnIndex: number, e: React.MouseEvent) => void;
  onTaskUpdate: (task: Task, newName: string) => void;
}

export function TaskItem({
  task,
  columnIndex,
  isSelected,
  isOpen,
  subtaskCount,
  onTaskClick,
  onTaskUpdate,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(task.name);
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

  return (
    <div
      onClick={(e) => onTaskClick(task, columnIndex, e)}
      className={cn(
        "group flex items-center justify-between gap-2 p-3 transition-all duration-300 cursor-pointer",
        isCompleted
          ? isSelected
            ? "bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/40"
            : "hover:bg-green-50 dark:hover:bg-green-800/30 opacity-50"
          : isSelected
          ? "bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40"
          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
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
