import React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "../utils";
import { Task } from "../types";
import { useDrag } from "../contexts/drag-context";

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
  onTaskToggle: (taskId: string) => void;
  onTaskDrop: (draggedTaskIds: string[], targetTaskId: string) => void;
  getAllSubtasks: (taskId: string) => Task[];
  onReorderDragOver?: (taskIndex: number, position: "above" | "below") => void;
  taskIndex?: number;
  isReorderDragActive?: boolean;
}

export function TaskItem({
  task,
  columnIndex,
  isSelected,
  isOpen,
  subtaskCount,
  selectedTasks,
  onTaskClick,
  onTaskUpdate,
  onTaskToggle,
  onTaskDrop,
  getAllSubtasks,
  onReorderDragOver,
  taskIndex,
  isReorderDragActive,
}: TaskItemProps) {
  const {
    currentDragData,
    setCurrentDragData,
    canDropOnTask,
    calculateDropPosition,
    getDropEffect,
  } = useDrag();

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
    onTaskClick(task, columnIndex, e);
    setIsEditing(true);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTaskToggle(task.id);
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

    const dragData = {
      type: "tasks",
      taskIds: tasksToDrag,
      sourceColumnIndex: columnIndex,
    };

    // Store in context for access during drag over
    setCurrentDragData(dragData);

    e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    // Clear context drag data when drag ends
    setCurrentDragData(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent column from getting drag over events

    if (!currentDragData || currentDragData.type !== "tasks") {
      e.dataTransfer.dropEffect = "none";
      return;
    }

    const isSameColumn = currentDragData.sourceColumnIndex === columnIndex;
    const isCrossColumn = !isSameColumn;
    const canDrop = canDropOnTask(task.id, getAllSubtasks);

    if (!canDrop) {
      e.dataTransfer.dropEffect = "none";
      return;
    }

    const dropPosition = calculateDropPosition(e);
    const isHoveringEdge = dropPosition.isHoveringEdge;

    // MODE 1: Reordering (same-column OR cross-column) when hovering over task edges
    if (
      isHoveringEdge &&
      onReorderDragOver &&
      taskIndex !== undefined &&
      (isReorderDragActive || isCrossColumn)
    ) {
      // Clear subtask drop indicator
      setIsDragOver(false);

      // Signal reorder position
      onReorderDragOver(taskIndex, dropPosition.position);
      e.dataTransfer.dropEffect = getDropEffect(isSameColumn, true, true);
      return;
    }

    // MODE 2: Creating subtasks when hovering over center (or when reordering not available)
    if (!isHoveringEdge || (!isReorderDragActive && isSameColumn)) {
      // Clear reorder indicators if we have access to them
      if (onReorderDragOver && (isReorderDragActive || isCrossColumn)) {
        onReorderDragOver(-1, "above"); // Clear drop position by using invalid index
      }

      e.dataTransfer.dropEffect = getDropEffect(isSameColumn, true);
      setIsDragOver(true);
      return;
    }

    // Default fallback
    e.dataTransfer.dropEffect = "none";
    setIsDragOver(false);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent column from getting drag enter events
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only remove drag over state if we're actually leaving this element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (data.type === "tasks" && data.taskIds) {
        // Handle subtask creation when dropping on a task
        // (Reordering between tasks is handled by the column component)

        // Validate the drop using centralized logic
        const canDrop = canDropOnTask(task.id, getAllSubtasks);

        if (canDrop) {
          const isSameColumn = data.sourceColumnIndex === columnIndex;
          const isCrossColumn = !isSameColumn;
          const dropPosition = calculateDropPosition(e);

          // Check if this is actually a reordering operation (edges) vs subtask creation (center)
          if (
            (isReorderDragActive || isCrossColumn) &&
            onReorderDragOver &&
            taskIndex !== undefined
          ) {
            if (dropPosition.isHoveringEdge) {
              // Dropped on edge - let column handle reordering by not stopping propagation
              return;
            } else {
              // Dropped on center - create subtask and stop propagation
              e.stopPropagation();
              onTaskDrop(data.taskIds, task.id);
            }
          } else {
            // Not in reorder mode or no reorder support - always create subtask
            e.stopPropagation();
            onTaskDrop(data.taskIds, task.id);
          }
        } else {
          // Can't drop - stop propagation to prevent column from handling
          e.stopPropagation();
        }
      } else {
        // Invalid data - stop propagation
        e.stopPropagation();
      }
    } catch (error) {
      console.error("Failed to handle drop:", error);
      e.stopPropagation();
    }
  };

  return (
    <div
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => onTaskClick(task, columnIndex, e)}
      className={cn(
        "group flex items-center justify-between gap-2 p-3 transition-all duration-300 cursor-pointer relative",
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
      <div
        className={cn(
          "flex items-center gap-3",
          isEditing ? "flex-1" : "overflow-hidden"
        )}
      >
        {/* Drag handle */}
        <div
          className={cn(
            "transition-colors relative z-10 cursor-grab active:cursor-grabbing",
            isCompleted
              ? "text-green-400 dark:text-green-500"
              : isSelected
              ? "text-blue-500 dark:text-blue-400"
              : "text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-400 dark:group-hover:text-neutral-500"
          )}
        >
          <GripVertical size={16} />
        </div>

        {/* Task name */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className={cn(
              "flex-1 text-sm font-medium transition-all duration-300 bg-transparent border-none outline-none cursor-text relative z-10",
              "ring-1 ring-blue-300 dark:ring-blue-600 rounded px-1 bg-white dark:bg-neutral-800"
            )}
          />
        ) : (
          <span
            onClick={handleTaskNameClick}
            className={cn(
              "text-sm font-medium transition-all duration-300 cursor-text select-none relative z-10 truncate",
              isCompleted
                ? isSelected
                  ? "line-through text-green-900 dark:text-green-100"
                  : "line-through text-neutral-500 dark:text-neutral-400"
                : isSelected
                ? "text-blue-900 dark:text-blue-100"
                : isOpen
                ? "text-neutral-800 dark:text-neutral-200"
                : "text-neutral-400 dark:text-neutral-500"
            )}
          >
            {task.name}
          </span>
        )}
      </div>

      {/* Right side items */}
      <div className="flex items-center gap-2 select-none relative z-10">
        {/* Subtask count badge */}
        {subtaskCount > 0 && (
          <div
            className={cn(
              "grid place-items-center text-xs font-bold size-5 rounded-full transition-colors",
              isCompleted
                ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50"
                : isSelected
                ? "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50"
                : isOpen
                ? "text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800"
                : "text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50"
            )}
          >
            <span>{subtaskCount}</span>
          </div>
        )}

        {/* Checkbox */}
        {subtaskCount === 0 && (
          <button
            onClick={handleCheckboxClick}
            className={cn(
              "flex shrink-0 items-center justify-center w-4 h-4 border-[1.5px] rounded transition-all duration-200 cursor-pointer",
              isCompleted
                ? "border-green-500 dark:border-green-400 text-white"
                : isSelected
                ? "border-blue-600 dark:border-blue-400 hover:border-blue-700 dark:hover:border-blue-300"
                : "border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500"
            )}
          >
            {isCompleted && (
              <svg
                width="10"
                height="8"
                viewBox="0 0 10 8"
                fill="none"
                className="text-green-500 dark:text-green-400"
              >
                <path
                  d="M9 1L3.5 6.5L1 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
