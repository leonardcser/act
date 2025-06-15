import { useEffect, useCallback } from "react";
import { Task, DateFilter } from "../types";
import { TaskService } from "../services/task-service";
import { UseAppStateReturn } from "./use-app-state";
import { getDateFromFilter } from "../utils/date";

interface TaskOperations {
  tasks: Task[];
  addTask: (name: string, parentId?: string, date?: Date) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  deleteTasks: (taskIds: string | string[]) => Promise<void>;
  reorderTasks: (taskIds: string[], parentId?: string) => Promise<void>;
  moveTasksToParent: (
    taskIds: string | string[],
    newParentId?: string
  ) => Promise<void>;
}

interface UseKeyboardProps {
  appState: UseAppStateReturn;
  taskOps: TaskOperations;
  selectedDateFilter?: DateFilter;
}

export const useKeyboard = ({
  appState,
  taskOps,
  selectedDateFilter,
}: UseKeyboardProps) => {
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
        const newTaskIndex = 0;
        appState.setFocusedTaskIndex(newTaskIndex);

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

  const reorderTaskVertical = useCallback(
    async (direction: "up" | "down") => {
      const focusedTask = getFocusedTask();
      if (!focusedTask) return;

      const currentColumn = appState.columns[appState.focusedColumn];
      const columnTasks = TaskService.getTasksByParentId(
        taskOps.tasks,
        currentColumn?.parentTaskId,
        appState.showCompleted
      );

      if (columnTasks.length <= 1) return;

      const currentIndex = appState.focusedTaskIndex;
      let targetIndex: number;

      if (direction === "up") {
        if (currentIndex === 0) return; // Already at top
        targetIndex = currentIndex - 1;
      } else {
        if (currentIndex === columnTasks.length - 1) return; // Already at bottom
        targetIndex = currentIndex + 1;
      }

      // Create new order by swapping positions
      const reorderedTasks = [...columnTasks];
      [reorderedTasks[currentIndex], reorderedTasks[targetIndex]] = [
        reorderedTasks[targetIndex],
        reorderedTasks[currentIndex],
      ];

      // Update task order in database
      const taskIds = reorderedTasks.map((task) => task.id);
      await taskOps.reorderTasks(taskIds, currentColumn?.parentTaskId);

      // Update focus to follow the moved task
      appState.setFocusedTaskIndex(targetIndex);
      appState.selectTask(focusedTask.id, appState.focusedColumn, targetIndex);
    },
    [getFocusedTask, taskOps, appState]
  );

  const reorderTaskHorizontal = useCallback(
    async (direction: "left" | "right") => {
      const focusedTask = getFocusedTask();
      if (!focusedTask) return;

      let targetColumnIndex: number;
      if (direction === "left") {
        if (appState.focusedColumn === 0) return; // Already in leftmost column
        targetColumnIndex = appState.focusedColumn - 1;
      } else {
        if (appState.focusedColumn === appState.columns.length - 1) return; // Already in rightmost column
        targetColumnIndex = appState.focusedColumn + 1;
      }

      const currentColumn = appState.columns[appState.focusedColumn];
      const targetColumn = appState.columns[targetColumnIndex];

      // Prevent moving a task to its own subtask column
      if (targetColumn?.parentTaskId === focusedTask.id) {
        return; // Cannot move a task to its own subtask column
      }

      // Get tasks in both columns
      const currentColumnTasks = TaskService.getTasksByParentId(
        taskOps.tasks,
        currentColumn?.parentTaskId,
        appState.showCompleted
      );
      const targetColumnTasks = TaskService.getTasksByParentId(
        taskOps.tasks,
        targetColumn?.parentTaskId,
        appState.showCompleted
      );

      // Move the task to the target column (this will add it to the end automatically)
      await taskOps.moveTasksToParent(
        focusedTask.id,
        targetColumn?.parentTaskId
      );

      // Reorder the current column to close the gap left by the moved task
      const remainingCurrentTasks = currentColumnTasks
        .filter((task) => task.id !== focusedTask.id)
        .map((task) => task.id);

      if (remainingCurrentTasks.length > 0) {
        await taskOps.reorderTasks(
          remainingCurrentTasks,
          currentColumn?.parentTaskId
        );
      }

      // Update focus to follow the moved task in the target column
      appState.setFocusedColumn(targetColumnIndex);
      const newTaskIndex = targetColumnTasks.length; // Task will be at the end
      appState.setFocusedTaskIndex(newTaskIndex);
      appState.selectTask(focusedTask.id, targetColumnIndex, newTaskIndex);
    },
    [getFocusedTask, taskOps, appState]
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

    await taskOps.deleteTasks(selectedTasksArray);
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

    // Get date from selected filter
    const taskDate = getDateFromFilter(selectedDateFilter);

    taskOps.addTask(appState.newTaskName, parentTaskId, taskDate);
    appState.closeModal();
  }, [appState, taskOps, selectedDateFilter]);

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

      // Task reordering with Shift + navigation keys
      if (e.shiftKey) {
        if (e.key === "ArrowUp" || e.key === "K") {
          e.preventDefault();
          reorderTaskVertical("up");
          return;
        } else if (e.key === "ArrowDown" || e.key === "J") {
          e.preventDefault();
          reorderTaskVertical("down");
          return;
        } else if (e.key === "ArrowLeft" || e.key === "H") {
          e.preventDefault();
          // reorderTaskHorizontal("left");
          return;
        } else if (e.key === "ArrowRight" || e.key === "L") {
          e.preventDefault();
          // reorderTaskHorizontal("right");
          return;
        }
      }

      // Regular navigation keys (without Shift)
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
          const currentColumn = appState.focusedColumn;
          const currentTaskIndex = appState.focusedTaskIndex;

          appState.openSubtasks(focusedTask, appState.focusedColumn);

          // Maintain focus on the current task, not the new subtasks column
          appState.setFocusedColumn(currentColumn);
          appState.setFocusedTaskIndex(currentTaskIndex);
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
    reorderTaskVertical,
    reorderTaskHorizontal,
    deleteSelectedTasks,
    selectAllTasksInColumn,
    addTask,
    appState,
    taskOps,
  ]);

  return {};
};
