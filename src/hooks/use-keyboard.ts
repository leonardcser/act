import { useEffect, useCallback } from "react";
import { Task } from "../types";
import { TaskService } from "../services/task-service";
import { UseAppStateReturn } from "./use-app-state";

interface TaskOperations {
  tasks: Task[];
  addTask: (name: string, parentId?: string) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  deleteMultipleTasks: (taskIds: string[]) => Promise<void>;
}

interface UseKeyboardProps {
  appState: UseAppStateReturn;
  taskOps: TaskOperations;
}

export const useKeyboard = ({ appState, taskOps }: UseKeyboardProps) => {
  const getFocusedTask = useCallback((): Task | null => {
    const columnTasks = TaskService.getTasksByParentId(
      taskOps.tasks,
      appState.columns[appState.focusedColumn]?.parentTaskId,
      appState.showCompleted
    );
    return columnTasks[appState.focusedTaskIndex] || null;
  }, [
    taskOps.tasks,
    appState.columns,
    appState.focusedColumn,
    appState.focusedTaskIndex,
    appState.showCompleted,
  ]);

  const navigateVertical = useCallback(
    (direction: "up" | "down") => {
      const columnTasks = TaskService.getTasksByParentId(
        taskOps.tasks,
        appState.columns[appState.focusedColumn]?.parentTaskId,
        appState.showCompleted
      );
      if (columnTasks.length === 0) return;

      let newIndex = appState.focusedTaskIndex;
      if (direction === "up") {
        newIndex = Math.max(0, appState.focusedTaskIndex - 1);
      } else {
        newIndex = Math.min(
          columnTasks.length - 1,
          appState.focusedTaskIndex + 1
        );
      }

      appState.setFocusedTaskIndex(newIndex);
      const focusedTask = columnTasks[newIndex];
      if (focusedTask) {
        appState.selectTask(focusedTask.id, appState.focusedColumn, newIndex);
      }
    },
    [taskOps.tasks, appState]
  );

  const navigateHorizontal = useCallback(
    (direction: "left" | "right") => {
      let newColumnIndex = appState.focusedColumn;

      if (direction === "left") {
        newColumnIndex = Math.max(0, appState.focusedColumn - 1);
      } else {
        newColumnIndex = Math.min(
          appState.columns.length - 1,
          appState.focusedColumn + 1
        );
      }

      if (newColumnIndex !== appState.focusedColumn) {
        appState.setFocusedColumn(newColumnIndex);
        const newColumnTasks = TaskService.getTasksByParentId(
          taskOps.tasks,
          appState.columns[newColumnIndex]?.parentTaskId,
          appState.showCompleted
        );
        const newTaskIndex = Math.min(0, newColumnTasks.length - 1);
        appState.setFocusedTaskIndex(Math.max(0, newTaskIndex));

        if (newColumnTasks.length > 0) {
          const focusedTask = newColumnTasks[newTaskIndex];
          appState.selectTask(focusedTask.id, newColumnIndex, newTaskIndex);
        } else {
          appState.setSelectedColumn(newColumnIndex);
        }
      }
    },
    [taskOps.tasks, appState]
  );

  const deleteSelectedTasks = useCallback(async () => {
    const selectedTasksArray = Array.from(appState.selectedTasks);

    // Close any open subtask columns for the tasks being deleted
    selectedTasksArray.forEach((taskId) => {
      const columnIndex = appState.columns.findIndex(
        (col) => col.parentTaskId === taskId
      );
      if (columnIndex > 0) {
        // Close from the column before the subtask column
        appState.closeSubtasksFromColumn(columnIndex - 1);
      }
    });

    await taskOps.deleteMultipleTasks(selectedTasksArray);
    appState.clearSelection();
  }, [appState.selectedTasks, taskOps, appState]);

  const selectAllTasksInColumn = useCallback(() => {
    appState.selectAllTasksInColumn(taskOps.tasks, appState.focusedColumn);
  }, [appState, taskOps.tasks]);

  const addTask = useCallback(() => {
    if (!appState.newTaskName.trim()) return;

    let parentTaskId: string | undefined;

    // If task(s) are selected, add as subtask of the first selected task
    if (appState.selectedTasks.size > 0) {
      parentTaskId = Array.from(appState.selectedTasks)[0];
    } else {
      // If no task selected, add to the current column
      parentTaskId = appState.columns[appState.selectedColumn]?.parentTaskId;
    }

    taskOps.addTask(appState.newTaskName, parentTaskId);
    appState.closeModal();
  }, [appState, taskOps]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle navigation keys when modal is open
      if (appState.isModalOpen) {
        if (e.key === "Escape") {
          appState.closeModal();
        } else if (e.key === "Enter") {
          e.preventDefault();
          addTask();
        }
        return;
      }

      // Space key to toggle completion of focused task
      if (e.key === " ") {
        e.preventDefault();
        const focusedTask = getFocusedTask();
        if (focusedTask) {
          taskOps.toggleTask(focusedTask.id);
        } else if (appState.selectedTasks.size === 1) {
          // If no focused task but exactly one task is selected, toggle that task
          const selectedTaskId = Array.from(appState.selectedTasks)[0];
          taskOps.toggleTask(selectedTaskId);
        }
        return;
      }

      // 'd' key to delete selected tasks
      if (e.key === "d" && appState.selectedTasks.size > 0) {
        e.preventDefault();
        deleteSelectedTasks();
        return;
      }

      // 't' key to toggle showing completed tasks
      if (e.key === "t") {
        e.preventDefault();
        appState.setShowCompleted(!appState.showCompleted);
        return;
      }

      // Command/Ctrl + A to select all tasks in current column
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selectAllTasksInColumn();
        return;
      }

      // Navigation keys
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        navigateVertical("up");
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        navigateVertical("down");
      } else if (e.key === "ArrowLeft" || e.key === "h") {
        e.preventDefault();
        navigateHorizontal("left");
      } else if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        navigateHorizontal("right");
      }
      // Other keys
      else if (e.key === "n" || e.key === "i") {
        e.preventDefault();
        appState.openModal();
      } else if (e.key === "Escape" && appState.selectedTasks.size > 0) {
        // Clear selection by selecting empty task
        appState.selectTask("", -1, -1);
      } else if (e.key === "Backspace" && appState.selectedTasks.size > 0) {
        e.preventDefault();
        deleteSelectedTasks();
      } else if (e.key === "Enter") {
        // Enter to open subtasks of focused task
        e.preventDefault();
        const focusedTask = getFocusedTask();
        if (focusedTask) {
          appState.openSubtasks(focusedTask, appState.focusedColumn);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    appState.isModalOpen,
    appState.selectedTasks,
    appState.showCompleted,
    appState.focusedColumn,
    appState.focusedTaskIndex,
    getFocusedTask,
    navigateVertical,
    navigateHorizontal,
    deleteSelectedTasks,
    selectAllTasksInColumn,
    addTask,
    appState,
    taskOps,
  ]);

  return {};
};
