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

// Generate date filter options
export const generateDateFilters = (tasks: Task[]): DateFilter[] => {
  const filters: DateFilter[] = [];
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Add Today filter
  filters.push({
    type: "today",
    date: today,
    label: "Today",
  });

  // Add Yesterday filter
  filters.push({
    type: "yesterday",
    date: yesterday,
    label: "Yesterday",
  });

  // Get all unique dates and add historical filters
  const uniqueDates = getTaskDates(tasks);

  uniqueDates.forEach((date) => {
    if (!isToday(date) && !isYesterday(date)) {
      filters.push({
        type: "date",
        date,
        label: formatDateLabel(date),
      });
    }
  });

  return filters;
};
