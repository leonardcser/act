import React from "react";
import { cn } from "../utils";
import { Task, Column, DateFilter } from "../types";
import { TaskItem } from "./task-item";
import { useDrag } from "../contexts/drag-context";

interface TaskColumnProps {
  column: Column;
  columnIndex: number;
  tasks: Task[];
  selectedTasks: Set<string>;
  selectedColumn: number;
  selectedDateFilter?: DateFilter;
  isTaskOpen: (taskId: string) => boolean;
  getAllSubtasks: (taskId: string) => Task[];
  onColumnClick: (columnIndex: number, e: React.MouseEvent) => void;
  onTaskClick: (task: Task, columnIndex: number, e: React.MouseEvent) => void;
  onTaskUpdate: (task: Task, newName: string) => void;
  onTaskDueDateUpdate: (task: Task, newDueDate: string) => void;
  onTaskToggle: (taskId: string) => void;
  onTaskDrop: (draggedTaskIds: string[], targetTaskId: string) => void;
  onColumnDrop: (draggedTaskIds: string[], targetColumnIndex: number) => void;
  onTaskReorder: (
    draggedTaskIds: string[],
    targetIndex: number,
    columnIndex: number
  ) => void;
}

export function TaskColumn({
  column,
  columnIndex,
  tasks,
  selectedTasks,
  selectedColumn,
  isTaskOpen,
  getAllSubtasks,
  onColumnClick,
  onTaskClick,
  onTaskUpdate,
  onTaskDueDateUpdate,
  onTaskToggle,
  onTaskDrop,
  onColumnDrop,
  onTaskReorder,
}: TaskColumnProps) {
  const { currentDragData, canDropInColumn, getDropEffect } = useDrag();
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [isReorderDragActive, setIsReorderDragActive] = React.useState(false);
  const [dropPosition, setDropPosition] = React.useState<{
    taskIndex: number;
    position: "above" | "below";
  } | null>(null);

  const isColumnSelected =
    selectedColumn === columnIndex && selectedTasks.size === 0;

  // Monitor drag state changes
  React.useEffect(() => {
    if (
      currentDragData &&
      currentDragData.type === "tasks" &&
      currentDragData.sourceColumnIndex === columnIndex
    ) {
      setIsReorderDragActive(true);
    } else {
      setIsReorderDragActive(false);
      setDropPosition(null);
    }
  }, [currentDragData, columnIndex]);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();

    if (!currentDragData || currentDragData.type !== "tasks") {
      e.dataTransfer.dropEffect = "none";
      return;
    }

    const isSameColumn = currentDragData.sourceColumnIndex === columnIndex;
    const canDrop = canDropInColumn(column.parentTaskId, getAllSubtasks);

    if (!canDrop) {
      e.dataTransfer.dropEffect = "none";
      return;
    }

    // Set drag over state for cross-column drops
    if (!isSameColumn) {
      setIsDragOver(true);
    }

    // Check if we're hovering over the empty space at the bottom of the column
    const columnElement = e.currentTarget as HTMLElement;
    const mouseY = e.clientY;

    // Find the last task element to determine if we're below all tasks
    const taskElements = columnElement.querySelectorAll("[data-task-item]");
    if (taskElements.length > 0 && tasks.length > 0) {
      const lastTaskElement = taskElements[taskElements.length - 1];
      const lastTaskRect = lastTaskElement.getBoundingClientRect();

      // If mouse is below the last task, set drop position to after the last task
      if (mouseY > lastTaskRect.bottom) {
        if (
          !dropPosition ||
          dropPosition.taskIndex !== tasks.length - 1 ||
          dropPosition.position !== "below"
        ) {
          setDropPosition({ taskIndex: tasks.length - 1, position: "below" });
        }
      }
    }

    e.dataTransfer.dropEffect = getDropEffect(isSameColumn, true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only remove drag over state if we're actually leaving this element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      // Clear drop position when leaving the column entirely
      setDropPosition(null);
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
        const canDrop = canDropInColumn(column.parentTaskId, getAllSubtasks);

        if (!canDrop) {
          return;
        }

        // Handle same-column reordering
        if (data.sourceColumnIndex === columnIndex && dropPosition) {
          let targetIndex = dropPosition.taskIndex;
          if (dropPosition.position === "below") {
            targetIndex += 1;
          }
          onTaskReorder(data.taskIds, targetIndex, columnIndex);
        }
        // Handle cross-column drops with positioning
        else if (data.sourceColumnIndex !== columnIndex) {
          if (dropPosition) {
            // Cross-column drop with specific position
            let targetIndex = dropPosition.taskIndex;
            if (dropPosition.position === "below") {
              targetIndex += 1;
            }

            onTaskReorder(data.taskIds, targetIndex, columnIndex);
          } else {
            // Cross-column drop at the end (fallback)
            onColumnDrop(data.taskIds, columnIndex);
          }
        }
      }
    } catch (error) {
      console.error("Failed to handle column drop:", error);
    } finally {
      setDropPosition(null);
    }
  };

  const handleTaskDragOver = (
    taskIndex: number,
    position: "above" | "below"
  ) => {
    // Support positioning for both same-column and cross-column drags
    if (
      isReorderDragActive ||
      (currentDragData && currentDragData.sourceColumnIndex !== columnIndex)
    ) {
      if (taskIndex < 0) {
        // Clear drop position when invalid index is passed (hovering over task centers)
        // But only if we're not at the bottom of the column
        const currentDropIsAtBottom =
          dropPosition &&
          dropPosition.taskIndex === tasks.length - 1 &&
          dropPosition.position === "below";

        if (!currentDropIsAtBottom) {
          setDropPosition(null);
        }
      } else {
        setDropPosition({ taskIndex, position });
      }
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
        className="flex-1 overflow-y-auto"
        onClick={(e) => onColumnClick(columnIndex, e)}
      >
        {tasks.length > 0 ? (
          <div className="flex flex-col">
            {tasks.map((task, index) => {
              const isDraggedTask = currentDragData?.taskIds.includes(task.id);
              const shouldShiftDown =
                dropPosition &&
                dropPosition.position === "above" &&
                dropPosition.taskIndex === index;
              const shouldShowDropLine =
                dropPosition &&
                ((dropPosition.position === "above" &&
                  dropPosition.taskIndex === index) ||
                  (dropPosition.position === "below" &&
                    dropPosition.taskIndex === index));

              return (
                <React.Fragment key={task.id}>
                  {/* Drop indicator line */}
                  {shouldShowDropLine && dropPosition.position === "above" && (
                    <div className="h-0.5 bg-blue-400 dark:bg-blue-500 mx-3 transition-all duration-200" />
                  )}

                  <div
                    data-task-item
                    className={cn(
                      "border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-all duration-200",
                      shouldShiftDown && "transform translate-y-2",
                      isDraggedTask &&
                        currentDragData?.sourceColumnIndex === columnIndex &&
                        "opacity-50"
                    )}
                  >
                    <TaskItem
                      task={task}
                      columnIndex={columnIndex}
                      isSelected={selectedTasks.has(task.id)}
                      isOpen={isTaskOpen(task.id)}
                      subtaskCount={task.totalSubtasks}
                      selectedTasks={selectedTasks}
                      openTaskIds={openTaskIds}
                      onTaskClick={onTaskClick}
                      onTaskUpdate={onTaskUpdate}
                      onTaskDueDateUpdate={onTaskDueDateUpdate}
                      onTaskToggle={onTaskToggle}
                      onTaskDrop={onTaskDrop}
                      getAllSubtasks={getAllSubtasks}
                      onReorderDragOver={handleTaskDragOver}
                      taskIndex={index}
                      isReorderDragActive={isReorderDragActive}
                    />
                  </div>

                  {/* Drop indicator line below */}
                  {shouldShowDropLine && dropPosition.position === "below" && (
                    <div className="h-0.5 bg-blue-400 dark:bg-blue-500 mx-3 transition-all duration-200" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
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
