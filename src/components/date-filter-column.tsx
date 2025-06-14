import { Calendar } from "lucide-react";
import { cn } from "../utils";
import { DateFilter } from "../types";

interface DateFilterColumnProps {
  dateFilters: DateFilter[];
  selectedDateFilter?: DateFilter;
  focusedDateIndex: number;
  onDateFilterClick: (filter: DateFilter, index: number) => void;
}

export function DateFilterColumn({
  dateFilters,
  selectedDateFilter,
  focusedDateIndex,
  onDateFilterClick,
}: DateFilterColumnProps) {
  const todayFilter = dateFilters.find((f) => f.type === "today");
  const yesterdayFilter = dateFilters.find((f) => f.type === "yesterday");
  const historicalFilters = dateFilters.filter((f) => f.type === "date");

  const allFilterItems = [
    ...(todayFilter ? [todayFilter] : []),
    ...(yesterdayFilter ? [yesterdayFilter] : []),
    ...historicalFilters,
  ];

  return (
    <div className="flex-shrink-0 w-48 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Today and Yesterday */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {todayFilter && (
            <DateFilterItem
              filter={todayFilter}
              index={0}
              isSelected={selectedDateFilter?.type === "today"}
              isFocused={focusedDateIndex === 0}
              onDateFilterClick={onDateFilterClick}
            />
          )}
          {yesterdayFilter && (
            <DateFilterItem
              filter={yesterdayFilter}
              index={1}
              isSelected={selectedDateFilter?.type === "yesterday"}
              isFocused={focusedDateIndex === 1}
              onDateFilterClick={onDateFilterClick}
            />
          )}
        </div>

        {/* Divider */}
        {historicalFilters.length > 0 && (
          <div className="border-t-2 border-neutral-200 dark:border-neutral-700 my-2" />
        )}

        {/* Historical dates */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {historicalFilters.map((filter, histIndex) => {
            const globalIndex =
              (todayFilter ? 1 : 0) + (yesterdayFilter ? 1 : 0) + histIndex;
            return (
              <DateFilterItem
                key={filter.date.toISOString()}
                filter={filter}
                index={globalIndex}
                isSelected={
                  selectedDateFilter?.type === "date" &&
                  selectedDateFilter.date.toDateString() ===
                    filter.date.toDateString()
                }
                isFocused={focusedDateIndex === globalIndex}
                onDateFilterClick={onDateFilterClick}
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
}

function DateFilterItem({
  filter,
  index,
  isSelected,
  isFocused,
  onDateFilterClick,
}: DateFilterItemProps) {
  return (
    <div
      onClick={() => onDateFilterClick(filter, index)}
      className={cn(
        "group flex items-center gap-3 p-3 transition-all duration-200 cursor-pointer select-none",
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40"
          : isFocused
          ? "bg-neutral-100 dark:bg-neutral-800/50"
          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
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
    </div>
  );
}
