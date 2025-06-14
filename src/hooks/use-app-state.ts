import { useState, useCallback } from "react";
import { Task, Column, DateFilter } from "../types";
import { TaskService } from "../services/task-service";

export interface UseAppStateReturn {
  // Selection state
  selectedTasks: Set<string>;
  selectedColumn: number;
  lastSelectedTask: {
    taskId: string;
    columnIndex: number;
    taskIndex: number;
  } | null;

  // Navigation state
  focusedColumn: number;
  focusedTaskIndex: number;
  focusedDateIndex: number;
  columns: Column[];
  showCompleted: boolean;

  // Modal state
  isModalOpen: boolean;
  newTaskName: string;

  // Selection actions
  setSelectedTasks: (tasks: Set<string>) => void;
  setSelectedColumn: (column: number) => void;
  setLastSelectedTask: (
    task: { taskId: string; columnIndex: number; taskIndex: number } | null
  ) => void;
  clearSelection: () => void;
  selectTask: (taskId: string, columnIndex: number, taskIndex: number) => void;
  toggleTaskSelection: (
    taskId: string,
    columnIndex: number,
    taskIndex: number
  ) => void;
  selectTaskRange: (
    tasks: Task[],
    taskId: string,
    columnIndex: number,
    taskIndex: number
  ) => void;
  selectAllTasksInColumn: (tasks: Task[], columnIndex: number) => void;

  // Navigation actions
  setFocusedColumn: (column: number) => void;
  setFocusedTaskIndex: (index: number) => void;
  setFocusedDateIndex: (index: number) => void;
  setColumns: (columns: Column[]) => void;
  setShowCompleted: (show: boolean) => void;
  openSubtasks: (task: Task, columnIndex: number) => void;
  closeSubtasksFromColumn: (columnIndex: number) => void;
  isTaskOpen: (taskId: string) => boolean;

  // Modal actions
  setNewTaskName: (name: string) => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useAppState = (): UseAppStateReturn => {
  // Selection state
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectedColumn, setSelectedColumn] = useState(0);
  const [lastSelectedTask, setLastSelectedTask] = useState<{
    taskId: string;
    columnIndex: number;
    taskIndex: number;
  } | null>(null);

  // Navigation state
  const [focusedColumn, setFocusedColumn] = useState(0);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState(0);
  const [focusedDateIndex, setFocusedDateIndex] = useState(0);
  const [columns, setColumns] = useState<Column[]>([{ level: 0 }]);
  const [showCompleted, setShowCompleted] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");

  // Selection actions
  const clearSelection = useCallback(() => {
    setSelectedTasks(new Set());
    setLastSelectedTask(null);
  }, []);

  const selectTask = useCallback(
    (taskId: string, columnIndex: number, taskIndex: number) => {
      if (taskId === "" && columnIndex === -1) {
        clearSelection();
        return;
      }
      setSelectedTasks(new Set([taskId]));
      setSelectedColumn(columnIndex);
      setLastSelectedTask({ taskId, columnIndex, taskIndex });
    },
    [clearSelection]
  );

  const toggleTaskSelection = useCallback(
    (taskId: string, columnIndex: number, taskIndex: number) => {
      setSelectedTasks((prev) => {
        const newSelection = new Set(prev);
        if (newSelection.has(taskId)) {
          newSelection.delete(taskId);
        } else {
          newSelection.add(taskId);
        }
        return newSelection;
      });
      setSelectedColumn(columnIndex);
      setLastSelectedTask({ taskId, columnIndex, taskIndex });
    },
    []
  );

  const selectTaskRange = useCallback(
    (tasks: Task[], taskId: string, columnIndex: number, taskIndex: number) => {
      if (lastSelectedTask && lastSelectedTask.columnIndex === columnIndex) {
        const tasksInColumn = TaskService.getTasksByParentId(
          tasks,
          columns[columnIndex]?.parentTaskId,
          showCompleted
        );
        const startIndex = Math.min(lastSelectedTask.taskIndex, taskIndex);
        const endIndex = Math.max(lastSelectedTask.taskIndex, taskIndex);

        const rangeTaskIds = tasksInColumn
          .slice(startIndex, endIndex + 1)
          .map((task) => task.id);

        setSelectedTasks((prev) => new Set([...prev, ...rangeTaskIds]));
      }

      setLastSelectedTask({ taskId, columnIndex, taskIndex });
    },
    [lastSelectedTask, columns, showCompleted]
  );

  const selectAllTasksInColumn = useCallback(
    (tasks: Task[], columnIndex: number) => {
      const tasksInColumn = TaskService.getTasksByParentId(
        tasks,
        columns[columnIndex]?.parentTaskId,
        showCompleted
      );
      const newSelection = new Set([
        ...selectedTasks,
        ...tasksInColumn.map((task) => task.id),
      ]);
      setSelectedTasks(newSelection);
    },
    [selectedTasks, columns, showCompleted]
  );

  // Navigation actions
  const openSubtasks = useCallback(
    (task: Task, columnIndex: number) => {
      const newColumns = columns.slice(0, columnIndex + 1);
      newColumns.push({
        parentTaskId: task.id,
        level: columnIndex + 1,
      });
      setColumns(newColumns);
      setFocusedColumn(columnIndex + 1);
      setFocusedTaskIndex(0);
    },
    [columns]
  );

  const closeSubtasksFromColumn = useCallback(
    (columnIndex: number) => {
      const newColumns = columns.slice(0, columnIndex + 1);
      setColumns(newColumns);
      setFocusedColumn(Math.min(focusedColumn, columnIndex));
    },
    [columns, focusedColumn]
  );

  const isTaskOpen = useCallback(
    (taskId: string): boolean => {
      return columns.some((column) => column.parentTaskId === taskId);
    },
    [columns]
  );

  // Modal actions
  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setNewTaskName("");
  }, []);

  return {
    // Selection state
    selectedTasks,
    selectedColumn,
    lastSelectedTask,

    // Navigation state
    focusedColumn,
    focusedTaskIndex,
    focusedDateIndex,
    columns,
    showCompleted,

    // Modal state
    isModalOpen,
    newTaskName,

    // Selection actions
    setSelectedTasks,
    setSelectedColumn,
    setLastSelectedTask,
    clearSelection,
    selectTask,
    toggleTaskSelection,
    selectTaskRange,
    selectAllTasksInColumn,

    // Navigation actions
    setFocusedColumn,
    setFocusedTaskIndex,
    setFocusedDateIndex,
    setColumns,
    setShowCompleted,
    openSubtasks,
    closeSubtasksFromColumn,
    isTaskOpen,

    // Modal actions
    setNewTaskName,
    openModal,
    closeModal,
  };
};
