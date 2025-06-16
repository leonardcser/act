import { DateFilter } from "../types";
import { DateFilterItem } from "./date-filter-item";

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
