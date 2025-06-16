import { Calendar } from "lucide-react";
import { cn } from "../utils";
import { DateFilter } from "../types";
import React from "react";
import { useDrag } from "../contexts/drag-context";
import { ProgressCircle } from "./progress-circle";

interface DateFilterItemProps {
  filter: DateFilter;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onDateFilterClick: (filter: DateFilter, index: number) => void;
  onDateFilterDrop?: (draggedTaskIds: string[], targetDate: Date) => void;
}

export function DateFilterItem({
  filter,
  index,
  isSelected,
  isFocused,
  onDateFilterClick,
  onDateFilterDrop,
}: DateFilterItemProps) {
  const { currentDragData, getDropEffect, setCurrentDragData } = useDrag();
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Get the target date for this filter
  const getTargetDate = (): Date | null => {
    switch (filter.type) {
      case "today":
        return new Date();
      case "tomorrow":
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      case "yesterday":
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
      case "date":
        return filter.date || null;
      default:
        return null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();

    if (!currentDragData || currentDragData.type !== "tasks") {
      e.dataTransfer.dropEffect = "none";
      setIsDragOver(false);
      return;
    }

    const targetDate = getTargetDate();
    const canDrop = targetDate && currentDragData.taskIds.length > 0;

    if (canDrop) {
      e.dataTransfer.dropEffect = getDropEffect(false, true); // false = cross-column (date filter)
      setIsDragOver(true);
    } else {
      e.dataTransfer.dropEffect = "none";
      setIsDragOver(false);
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
      if (data.type === "tasks" && data.taskIds && onDateFilterDrop) {
        const targetDate = getTargetDate();
        if (targetDate) {
          // Clear drag context immediately to prevent visual artifacts
          setCurrentDragData(null);
          onDateFilterDrop(data.taskIds, targetDate);
        }
      }
    } catch (error) {
      console.error("Failed to handle date filter drop:", error);
    }
  };

  return (
    <div
      onClick={() => onDateFilterClick(filter, index)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group flex items-center gap-3 p-3 transition-all duration-200 cursor-pointer select-none",
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40"
          : isFocused
          ? "bg-neutral-100 dark:bg-neutral-800/50"
          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
        isDragOver &&
          "ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
      )}
    >
      <div
        className={cn(
          "transition-colors",
          isSelected
            ? "text-blue-600 dark:text-blue-400"
            : "text-neutral-400 dark:text-neutral-500"
        )}
      >
        <Calendar size={14} />
      </div>
      <span
        className={cn(
          "flex-1 text-sm font-medium transition-colors",
          isSelected
            ? "text-blue-900 dark:text-blue-100"
            : isFocused
            ? "text-neutral-800 dark:text-neutral-200"
            : "text-neutral-600 dark:text-neutral-400"
        )}
      >
        {filter.label}
      </span>
      {filter.totalTaskCount &&
      filter.totalTaskCount > 0 &&
      filter.completedTaskCount !== filter.totalTaskCount ? (
        <ProgressCircle
          total={filter.totalTaskCount}
          completed={filter.completedTaskCount || 0}
          isSelected={isSelected}
          size={20}
          className={cn(
            isSelected
              ? "text-blue-700 dark:text-blue-300"
              : isFocused
              ? "text-neutral-700 dark:text-neutral-300"
              : "text-neutral-500 dark:text-neutral-400"
          )}
        />
      ) : null}
    </div>
  );
}
