import { useState, useEffect, useCallback } from "react";
import { Task, DateFilter } from "../types";
import { TaskService } from "../services/task-service";

export interface UseTasksReturn {
  tasks: Task[];
  selectedDateFilter?: DateFilter;
  dateFilters: DateFilter[];
  loading: boolean;
  error: string | null;
  setSelectedDateFilter: (filter?: DateFilter) => void;
  addTask: (name: string, parentId?: string, date?: Date) => Promise<void>;
  updateTask: (id: string, name: string) => Promise<void>;
  deleteTasks: (taskIds: string | string[]) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  loadTasks: (dateFilter?: DateFilter) => Promise<void>;
}

export const useTasks = (): UseTasksReturn => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDateFilter, setSelectedDateFilter] = useState<
    DateFilter | undefined
  >(undefined);
  const [dateFilters, setDateFilters] = useState<DateFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load date filters from database independently
  const loadDateFilters = useCallback(async () => {
    try {
      const filters = await TaskService.generateDateFiltersFromDatabase();
      setDateFilters(filters);

      // Set today as default filter on first load
      if (!hasInitialized && !selectedDateFilter) {
        const todayFilter = filters.find((f) => f.type === "today");
        if (todayFilter) {
          setSelectedDateFilter(todayFilter);
        }
        setHasInitialized(true);
      }
    } catch (err) {
      console.error("Failed to load date filters:", err);
    }
  }, [hasInitialized, selectedDateFilter]);

  const loadTasks = useCallback(async (dateFilter?: DateFilter) => {
    try {
      setLoading(true);
      setError(null);
      const loadedTasks = await TaskService.loadTasks(dateFilter);
      setTasks(loadedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addTask = useCallback(
    async (name: string, parentId?: string, date?: Date) => {
      try {
        await TaskService.createTask(name, parentId, date);
        // Reload tasks to get updated parent completion states
        await loadTasks(selectedDateFilter);
        // Reload date filters in case new date was added
        await loadDateFilters();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create task");
        console.error("Failed to create task:", err);
      }
    },
    [loadTasks, selectedDateFilter, loadDateFilters]
  );

  const updateTask = useCallback(async (id: string, name: string) => {
    try {
      await TaskService.updateTask(id, name);
      setTasks((prev) =>
        prev.map((task) => (task.id === id ? { ...task, name } : task))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
      console.error("Failed to update task:", err);
    }
  }, []);

  const deleteTasks = useCallback(
    async (taskIds: string | string[]) => {
      try {
        await TaskService.deleteTasks(taskIds);
        // Reload tasks to get updated parent completion states
        await loadTasks(selectedDateFilter);
        // Reload date filters in case dates were removed
        await loadDateFilters();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete tasks");
        console.error("Failed to delete tasks:", err);
      }
    },
    [loadTasks, selectedDateFilter, loadDateFilters]
  );

  const toggleTask = useCallback(
    async (id: string) => {
      try {
        await TaskService.toggleTask(id);
        await loadTasks(selectedDateFilter);
        // Reload date filters in case completion dates changed
        await loadDateFilters();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to toggle task");
        console.error("Failed to toggle task:", err);
      }
    },
    [loadTasks, selectedDateFilter, loadDateFilters]
  );

  // Load date filters on mount
  useEffect(() => {
    loadDateFilters();
  }, [loadDateFilters]);

  // Load tasks when date filter changes or on initialization
  useEffect(() => {
    if (hasInitialized) {
      loadTasks(selectedDateFilter);
    }
  }, [loadTasks, selectedDateFilter, hasInitialized]);

  return {
    tasks,
    selectedDateFilter,
    dateFilters,
    loading,
    error,
    setSelectedDateFilter,
    addTask,
    updateTask,
    deleteTasks,
    toggleTask,
    loadTasks,
  };
};
