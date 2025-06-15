import { Calendar } from "lucide-react";
import { cn } from "../utils";
import { DateFilter } from "../types";
import React from "react";

interface DateFilterColumnProps {
  dateFilters: DateFilter[];
  selectedDateFilter?: DateFilter;
  focusedDateIndex: number;
  onDateFilterClick: (filter: DateFilter, index: number) => void;
  onDateFilterDrop?: (draggedTaskIds: string[], targetDate: Date) => void;
}

export function DateFilterColumn({
  dateFilters,
  selectedDateFilter,
  focusedDateIndex,
  onDateFilterClick,
  onDateFilterDrop,
}: DateFilterColumnProps) {
  const todayFilter = dateFilters.find((f) => f.type === "today");
  const tomorrowFilter = dateFilters.find((f) => f.type === "tomorrow");
  const yesterdayFilter = dateFilters.find((f) => f.type === "yesterday");
  const historicalFilters = dateFilters.filter((f) => f.type === "date");

  const allFilterItems = [
    ...(todayFilter ? [todayFilter] : []),
    ...(tomorrowFilter ? [tomorrowFilter] : []),
    ...(yesterdayFilter ? [yesterdayFilter] : []),
    ...historicalFilters,
  ];

  return (
    <div className="flex-shrink-0 w-48 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Today and Tomorrow */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {todayFilter && (
            <DateFilterItem
              filter={todayFilter}
              index={0}
              isSelected={selectedDateFilter?.type === "today"}
              isFocused={focusedDateIndex === 0}
              onDateFilterClick={onDateFilterClick}
              onDateFilterDrop={onDateFilterDrop}
            />
          )}
          {tomorrowFilter && (
            <DateFilterItem
              filter={tomorrowFilter}
              index={1}
              isSelected={selectedDateFilter?.type === "tomorrow"}
              isFocused={focusedDateIndex === 1}
              onDateFilterClick={onDateFilterClick}
              onDateFilterDrop={onDateFilterDrop}
            />
          )}
        </div>

        {/* Divider */}
        {(yesterdayFilter || historicalFilters.length > 0) && (
          <div className="border-t-2 border-neutral-200 dark:border-neutral-700" />
        )}

        {/* Yesterday and Historical dates */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {yesterdayFilter && (
            <DateFilterItem
              filter={yesterdayFilter}
              index={(todayFilter ? 1 : 0) + (tomorrowFilter ? 1 : 0)}
              isSelected={selectedDateFilter?.type === "yesterday"}
              isFocused={
                focusedDateIndex ===
                (todayFilter ? 1 : 0) + (tomorrowFilter ? 1 : 0)
              }
              onDateFilterClick={onDateFilterClick}
              onDateFilterDrop={onDateFilterDrop}
            />
          )}
          {historicalFilters.map((filter, histIndex) => {
            const globalIndex =
              (todayFilter ? 1 : 0) +
              (tomorrowFilter ? 1 : 0) +
              (yesterdayFilter ? 1 : 0) +
              histIndex;
            return (
              <DateFilterItem
                key={
                  filter.date?.toISOString() || `${filter.type}-${histIndex}`
                }
                filter={filter}
                index={globalIndex}
                isSelected={
                  selectedDateFilter?.type === "date" &&
                  !!selectedDateFilter.date &&
                  !!filter.date &&
                  selectedDateFilter.date.toDateString() ===
                    filter.date.toDateString()
                }
                isFocused={focusedDateIndex === globalIndex}
                onDateFilterClick={onDateFilterClick}
                onDateFilterDrop={onDateFilterDrop}
              />
            );
          })}
        </div>

        {allFilterItems.length === 0 && (
          <div className="text-center py-8 text-neutral-400 dark:text-neutral-500 text-sm">
            No dates yet
          </div>
        )}
      </div>
    </div>
  );
}

interface DateFilterItemProps {
  filter: DateFilter;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onDateFilterClick: (filter: DateFilter, index: number) => void;
  onDateFilterDrop?: (draggedTaskIds: string[], targetDate: Date) => void;
}

function DateFilterItem({
  filter,
  index,
  isSelected,
  isFocused,
  onDateFilterClick,
  onDateFilterDrop,
}: DateFilterItemProps) {
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

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
      if (data.type === "tasks" && data.taskIds && getTargetDate()) {
        e.dataTransfer.dropEffect = "copy"; // Use copy icon to indicate date change
        setIsDragOver(true);
      } else {
        e.dataTransfer.dropEffect = "none";
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
      if (data.type === "tasks" && data.taskIds && onDateFilterDrop) {
        const targetDate = getTargetDate();
        if (targetDate) {
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
          "ring-2 ring-green-400 dark:ring-green-500 bg-green-50/50 dark:bg-green-900/20"
      )}
    >
      <div
        className={cn(
          "transition-colors",
          isSelected
            ? "text-blue-600 dark:text-blue-400"
            : isDragOver
            ? "text-green-600 dark:text-green-400"
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
            : isDragOver
            ? "text-green-800 dark:text-green-200"
            : isFocused
            ? "text-neutral-800 dark:text-neutral-200"
            : "text-neutral-600 dark:text-neutral-400"
        )}
      >
        {filter.label}
        {isDragOver && <span className="ml-2 text-xs">(Change date)</span>}
      </span>
    </div>
  );
}
