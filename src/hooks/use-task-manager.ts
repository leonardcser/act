import { useEffect, useCallback, useState } from "react";
import { Task, DateFilter } from "../types";
import { TaskService } from "../services/task-service";
import { useTasks } from "./use-tasks";
import { useAppState } from "./use-app-state";

export interface UseTaskManagerReturn {
  // Task data
  tasks: Task[];
  selectedDateFilter?: DateFilter;
  dateFilters: DateFilter[];
  loading: boolean;
  error: string | null;

  // App state
  appState: ReturnType<typeof useAppState>;

  // Helper functions
  getTasksByParentId: (parentId?: string) => Task[];
  getTaskById: (id: string) => Task | undefined;
  getAllSubtasks: (taskId: string) => Task[];

  // Task actions
  updateTaskName: (taskId: string, newName: string) => void;
  setSelectedDateFilter: (filter?: DateFilter) => void;
  loadTasks: (dateFilter?: DateFilter) => Promise<void>;
  addTask: (name: string, parentId?: string, date?: Date) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  deleteTasks: (taskIds: string | string[]) => Promise<void>;
  reorderTasks: (taskIds: string[], parentId?: string) => Promise<void>;
  moveTasksToParent: (
    taskIds: string | string[],
    newParentId?: string
  ) => Promise<void>;
  updateTasksDates: (
    taskIds: string | string[],
    newDate: Date
  ) => Promise<void>;
}

export const useTaskManager = (): UseTaskManagerReturn => {
  const tasks = useTasks();
  const appState = useAppState();
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  // Helper functions that depend on current state
  const getTasksByParentId = useCallback(
    (parentId?: string): Task[] => {
      return TaskService.getTasksByParentId(
        tasks.tasks,
        parentId,
        appState.showCompleted
      );
    },
    [tasks.tasks, appState.showCompleted]
  );

  const getTaskById = useCallback(
    (id: string): Task | undefined => {
      return TaskService.getTaskById(tasks.tasks, id);
    },
    [tasks.tasks]
  );

  const getAllSubtasks = useCallback(
    (taskId: string): Task[] => {
      return TaskService.getAllSubtasks(tasks.tasks, taskId);
    },
    [tasks.tasks]
  );

  // Initialize focus on the first task when tasks are loaded (only once)
  useEffect(() => {
    if (
      !tasks.loading &&
      tasks.tasks.length > 0 &&
      appState.columns.length > 0 &&
      !hasInitializedSelection
    ) {
      const firstColumnTasks = getTasksByParentId(
        appState.columns[0]?.parentTaskId
      );
      if (firstColumnTasks.length > 0) {
        appState.setFocusedColumn(0);
        appState.setFocusedTaskIndex(0);
        appState.setSelectedColumn(0);
        appState.selectTask(firstColumnTasks[0].id, 0, 0);
        setHasInitializedSelection(true);
      }
    }
  }, [
    tasks.loading,
    tasks.tasks.length,
    appState.columns.length,
    hasInitializedSelection,
    getTasksByParentId,
    appState,
  ]);

  const updateTaskName = useCallback(
    (taskId: string, newName: string) => {
      tasks.updateTask(taskId, newName);
    },
    [tasks]
  );

  const reorderTasks = useCallback(
    async (taskIds: string[], parentId?: string) => {
      await TaskService.reorderTasks(taskIds, parentId);
      // Refresh tasks to get updated order
      await tasks.loadTasks(tasks.selectedDateFilter);
    },
    [tasks]
  );

  const moveTasksToParent = useCallback(
    async (taskIds: string | string[], newParentId?: string) => {
      await TaskService.moveTasksToParent(taskIds, newParentId);
      // Refresh tasks to get updated order
      await tasks.loadTasks(tasks.selectedDateFilter);
    },
    [tasks]
  );

  const updateTasksDates = useCallback(
    async (taskIds: string | string[], newDate: Date) => {
      await TaskService.updateTasksDates(taskIds, newDate);
      // Refresh tasks to get updated dates
      await tasks.loadTasks(tasks.selectedDateFilter);
      // Refresh date filters for counts
      await tasks.loadDateFilters();
    },
    [tasks]
  );

  return {
    // Task data
    tasks: tasks.tasks,
    selectedDateFilter: tasks.selectedDateFilter,
    dateFilters: tasks.dateFilters,
    loading: tasks.loading,
    error: tasks.error,

    // App state
    appState,

    // Helper functions
    getTasksByParentId,
    getTaskById,
    getAllSubtasks,

    // Task actions
    updateTaskName,
    setSelectedDateFilter: tasks.setSelectedDateFilter,
    loadTasks: tasks.loadTasks,
    addTask: tasks.addTask,
    toggleTask: tasks.toggleTask,
    deleteTasks: tasks.deleteTasks,
    reorderTasks,
    moveTasksToParent,
    updateTasksDates,
  };
};
