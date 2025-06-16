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
  uncompletedCounts: Map<string, number>
): DateFilter[] => {
  const filters: DateFilter[] = [];
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const toYYYYMMDD = (d: Date) => d.toISOString().split("T")[0];

  // Always add Today filter
  filters.push({
    type: "today",
    date: today,
    label: "Today",
    uncompletedTaskCount: uncompletedCounts.get(toYYYYMMDD(today)) || 0,
  });

  // Always add Tomorrow filter
  filters.push({
    type: "tomorrow",
    date: tomorrow,
    label: "Tomorrow",
    uncompletedTaskCount: uncompletedCounts.get(toYYYYMMDD(tomorrow)) || 0,
  });

  // Add Yesterday filter if there are tasks for yesterday
  const hasYesterdayTasks = distinctDates.some((date) => isYesterday(date));
  if (hasYesterdayTasks) {
    filters.push({
      type: "yesterday",
      date: yesterday,
      label: "Yesterday",
      uncompletedTaskCount: uncompletedCounts.get(toYYYYMMDD(yesterday)) || 0,
    });
  }

  // Add historical filters for other dates
  distinctDates.forEach((date) => {
    if (!isToday(date) && !isTomorrow(date) && !isYesterday(date)) {
      filters.push({
        type: "date",
        date,
        label: formatDateLabel(date),
        uncompletedTaskCount: uncompletedCounts.get(toYYYYMMDD(date)) || 0,
      });
    }
  });

  return filters;
};

// Generate date filter options
export const generateDateFilters = (tasks: Task[]): DateFilter[] => {
  const filters: DateFilter[] = [];
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Always add Today filter
  filters.push({
    type: "today",
    date: today,
    label: "Today",
  });

  // Always add Tomorrow filter
  filters.push({
    type: "tomorrow",
    date: tomorrow,
    label: "Tomorrow",
  });

  // Get all unique dates from tasks
  const uniqueDates = getTaskDates(tasks);

  // Add Yesterday filter only if there are tasks for yesterday
  const hasYesterdayTasks = uniqueDates.some((date) => isYesterday(date));
  if (hasYesterdayTasks) {
    filters.push({
      type: "yesterday",
      date: yesterday,
      label: "Yesterday",
    });
  }

  // Add historical filters for other dates
  uniqueDates.forEach((date) => {
    if (!isToday(date) && !isTomorrow(date) && !isYesterday(date)) {
      filters.push({
        type: "date",
        date,
        label: formatDateLabel(date),
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
