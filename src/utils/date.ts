import { DateFilter, Task } from "../types";

// Check if a date is today
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// Check if a date is tomorrow
export const isTomorrow = (date: Date): boolean => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear()
  );
};

// Check if a date is yesterday
export const isYesterday = (date: Date): boolean => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
};

// Format date for display (e.g., "Dec 15" or "Dec 15, 2023" if not current year)
export const formatDateLabel = (date: Date): string => {
  const today = new Date();
  const isCurrentYear = date.getFullYear() === today.getFullYear();

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  };

  return date.toLocaleDateString("en-US", options);
};

// Get all unique dates from tasks (created or completed)
export const getTaskDates = (tasks: Task[]): Date[] => {
  const dates = new Set<string>();

  tasks.forEach((task) => {
    // Add creation date
    dates.add(task.dateCreated.toDateString());

    // Add completion date if exists
    if (task.completedAt) {
      dates.add(task.completedAt.toDateString());
    }
  });

  return Array.from(dates)
    .map((dateStr) => new Date(dateStr))
    .sort((a, b) => b.getTime() - a.getTime()); // Sort newest first
};

// Generate date filter options from distinct dates
export const generateDateFiltersFromDates = (
  distinctDates: Date[],
  taskCounts: Map<string, { total: number; completed: number }>
): DateFilter[] => {
  const filters: DateFilter[] = [];
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const toYYYYMMDD = (d: Date) => d.toISOString().split("T")[0];

  const getCounts = (date: Date) => {
    const counts = taskCounts.get(toYYYYMMDD(date));
    return {
      totalTaskCount: counts?.total || 0,
      completedTaskCount: counts?.completed || 0,
    };
  };

  // Always add Today filter
  filters.push({
    type: "today",
    date: today,
    label: "Today",
    ...getCounts(today),
  });

  // Always add Tomorrow filter
  filters.push({
    type: "tomorrow",
    date: tomorrow,
    label: "Tomorrow",
    ...getCounts(tomorrow),
  });

  // Add Yesterday filter if there are tasks for yesterday
  const hasYesterdayTasks = distinctDates.some((date) => isYesterday(date));
  if (hasYesterdayTasks) {
    filters.push({
      type: "yesterday",
      date: yesterday,
      label: "Yesterday",
      ...getCounts(yesterday),
    });
  }

  // Add historical filters for other dates
  distinctDates.forEach((date) => {
    if (!isToday(date) && !isTomorrow(date) && !isYesterday(date)) {
      filters.push({
        type: "date",
        date,
        label: formatDateLabel(date),
        ...getCounts(date),
      });
    }
  });

  return filters;
};

// Get a Date object from a DateFilter
export const getDateFromFilter = (filter?: DateFilter): Date | undefined => {
  if (!filter) return undefined;

  const today = new Date();
  switch (filter.type) {
    case "today":
      return today;
    case "tomorrow":
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    case "yesterday":
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    case "date":
      return filter.date;
    case "range":
      return filter.startDate; // Use start date for range filters
    default:
      return undefined;
  }
};
