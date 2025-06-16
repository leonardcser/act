import { useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useTaskManager } from "./hooks/use-task-manager";
import { useKeyboard } from "./hooks/use-keyboard";
import { TaskColumn } from "./components/task-column";
import { ActionBar } from "./components/action-bar";
import { DateFilterColumn } from "./components/date-filter-column";
import { Task, DateFilter } from "./types";
import { getDateFromFilter } from "./utils/date";
import { DragProvider } from "./contexts/drag-context";

function App() {
  const taskManager = useTaskManager();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useKeyboard({
    appState: taskManager.appState,
    taskOps: {
      tasks: taskManager.tasks,
      addTask: taskManager.addTask,
      toggleTask: taskManager.toggleTask,
      deleteTasks: taskManager.deleteTasks,
      reorderTasks: taskManager.reorderTasks,
      moveTasksToParent: taskManager.moveTasksToParent,
    },
    selectedDateFilter: taskManager.selectedDateFilter,
  });

  // Event handlers
  const handleTaskClick = useCallback(
    (task: Task, columnIndex: number, e: React.MouseEvent) => {
      // Update focus position to match clicked task
      taskManager.appState.setFocusedColumn(columnIndex);
      const columnTasks = taskManager.getTasksByParentId(
        taskManager.appState.columns[columnIndex]?.parentTaskId
      );
      const taskIndex = columnTasks.findIndex((t) => t.id === task.id);
      if (taskIndex >= 0) {
        taskManager.appState.setFocusedTaskIndex(taskIndex);
      }

      if (e.shiftKey) {
        // Shift+click for range selection
        e.preventDefault();
        e.stopPropagation();
        taskManager.appState.selectTaskRange(
          taskManager.tasks,
          task.id,
          columnIndex,
          taskIndex
        );
        taskManager.appState.setSelectedColumn(columnIndex);
      } else if (e.metaKey || e.ctrlKey) {
        // Command/Ctrl+click to toggle individual selection
        e.preventDefault();
        e.stopPropagation();
        taskManager.appState.toggleTaskSelection(
          task.id,
          columnIndex,
          taskIndex
        );
      } else {
        // Regular click - select this task exclusively and open subtasks
        e.preventDefault();
        e.stopPropagation();
        taskManager.appState.selectTask(task.id, columnIndex, taskIndex);
        taskManager.appState.openSubtasks(task, columnIndex);

        // Maintain focus on the clicked task, not the new subtasks column
        taskManager.appState.setFocusedColumn(columnIndex);
        taskManager.appState.setFocusedTaskIndex(taskIndex);

        // Scroll to show new column
        setTimeout(() => {
          scrollContainerRef.current?.scrollTo({
            left: scrollContainerRef.current.scrollWidth,
            behavior: "smooth",
          });
        }, 50);
      }
    },
    [taskManager]
  );

  const handleColumnClick = useCallback(
    (columnIndex: number, e: React.MouseEvent) => {
      // Only handle if clicking on column background, not on tasks
      if (e.target === e.currentTarget) {
        taskManager.appState.setSelectedColumn(columnIndex);
        taskManager.appState.setFocusedColumn(columnIndex);
        taskManager.appState.setSelectedTasks(new Set()); // Clear task selection when selecting column

        // Close subtasks columns to the right of clicked column
        taskManager.appState.closeSubtasksFromColumn(columnIndex);

        // Reset task focus to first task in column
        taskManager.appState.setFocusedTaskIndex(0);
      }
    },
    [taskManager]
  );

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      // Only deselect if clicking on the background, not on task items
      if (e.target === e.currentTarget) {
        taskManager.appState.setSelectedTasks(new Set());
      }
    },
    [taskManager]
  );

  const handleDateFilterClick = useCallback(
    (filter: DateFilter, index: number) => {
      taskManager.setSelectedDateFilter(filter);
      taskManager.appState.setFocusedDateIndex(index);
      taskManager.appState.setSelectedTasks(new Set()); // Clear task selection

      // When date filter changes, reset columns to the root view
      if (taskManager.appState.columns.length > 1) {
        // This effectively closes all subtask columns
        taskManager.appState.closeSubtasksFromColumn(0);
        taskManager.appState.setFocusedTaskIndex(0);
      }
    },
    [taskManager]
  );

  const handleDateFilterDrop = useCallback(
    async (draggedTaskIds: string[], targetDate: Date) => {
      try {
        // Move tasks to root level (remove parent) when dropping on date filter
        await taskManager.moveTasksToParent(draggedTaskIds, undefined);

        // Update the dates for all dragged tasks and their subtasks
        await taskManager.updateTasksDates(draggedTaskIds, targetDate);

        // Clear selection after successful drop
        taskManager.appState.setSelectedTasks(new Set());
      } catch (error) {
        console.error("Failed to update task dates:", error);
      }
    },
    [taskManager]
  );

  const handleTaskUpdate = useCallback(
    (task: Task, newName: string) => {
      taskManager.updateTaskName(task.id, newName);
    },
    [taskManager]
  );

  const handleTaskDrop = useCallback(
    async (draggedTaskIds: string[], targetTaskId: string) => {
      try {
        // Close subtask columns of dragged tasks before moving them
        draggedTaskIds.forEach((taskId) => {
          const subtaskColumnIndex = taskManager.appState.columns.findIndex(
            (column) => column.parentTaskId === taskId
          );
          if (subtaskColumnIndex > 0) {
            // Close the subtask column of this dragged task
            taskManager.appState.closeSubtasksFromColumn(
              subtaskColumnIndex - 1
            );
          }
        });

        // Move all dragged tasks to become subtasks of the target task
        await taskManager.moveTasksToParent(draggedTaskIds, targetTaskId);

        // Find the target task and open its subtask column to show the moved tasks
        const targetTask = taskManager.tasks.find(
          (task) => task.id === targetTaskId
        );
        if (targetTask) {
          // Find which column contains the target task
          const targetColumnIndex = taskManager.appState.columns.findIndex(
            (column) => {
              const columnTasks = taskManager.getTasksByParentId(
                column.parentTaskId
              );
              return columnTasks.some((task) => task.id === targetTaskId);
            }
          );

          if (targetColumnIndex >= 0) {
            // Open the subtask column for the target task
            taskManager.appState.openSubtasks(targetTask, targetColumnIndex);

            // Select and focus the newly opened subtask column
            const newSubtaskColumnIndex = targetColumnIndex + 1;
            taskManager.appState.setSelectedColumn(newSubtaskColumnIndex);
            taskManager.appState.setFocusedColumn(newSubtaskColumnIndex);
            taskManager.appState.setFocusedTaskIndex(0);

            // Scroll to show the new column
            setTimeout(() => {
              scrollContainerRef.current?.scrollTo({
                left: scrollContainerRef.current.scrollWidth,
                behavior: "smooth",
              });
            }, 50);
          }
        }

        // Clear selection after successful drop
        taskManager.appState.setSelectedTasks(new Set());
      } catch (error) {
        console.error("Failed to move tasks:", error);
      }
    },
    [taskManager]
  );

  const handleColumnDrop = useCallback(
    async (draggedTaskIds: string[], targetColumnIndex: number) => {
      try {
        const targetColumn = taskManager.appState.columns[targetColumnIndex];

        // Close subtask columns of dragged tasks before moving them
        draggedTaskIds.forEach((taskId) => {
          const subtaskColumnIndex = taskManager.appState.columns.findIndex(
            (column) => column.parentTaskId === taskId
          );
          if (subtaskColumnIndex > 0) {
            // Close the subtask column of this dragged task
            taskManager.appState.closeSubtasksFromColumn(
              subtaskColumnIndex - 1
            );
          }
        });

        // Move all dragged tasks to the target column
        await taskManager.moveTasksToParent(
          draggedTaskIds,
          targetColumn?.parentTaskId
        );

        // Clear selection after successful drop
        taskManager.appState.setSelectedTasks(new Set());
      } catch (error) {
        console.error("Failed to move tasks to column:", error);
      }
    },
    [taskManager]
  );

  const handleTaskReorder = useCallback(
    async (
      draggedTaskIds: string[],
      targetIndex: number,
      columnIndex: number
    ) => {
      try {
        const column = taskManager.appState.columns[columnIndex];
        const columnTasks = taskManager.getTasksByParentId(
          column?.parentTaskId
        );

        // Check if this is a cross-column operation by seeing if dragged tasks exist in target column
        const draggedTasksInTargetColumn = draggedTaskIds
          .map((id) => columnTasks.find((task) => task.id === id))
          .filter((task): task is Task => task !== undefined);

        const isCrossColumn = draggedTasksInTargetColumn.length === 0;

        if (isCrossColumn) {
          // Cross-column operation: move tasks to new parent and position them

          // Get the tasks being moved BEFORE moving them (while they still exist in original location)
          const tasksBeingMoved = draggedTaskIds
            .map((id) => taskManager.tasks.find((task) => task.id === id))
            .filter((task): task is Task => task !== undefined);

          // Get existing tasks in target column BEFORE the move
          const existingTargetTasks = columnTasks;

          // Close subtask columns of dragged tasks before moving them
          draggedTaskIds.forEach((taskId) => {
            const subtaskColumnIndex = taskManager.appState.columns.findIndex(
              (column) => column.parentTaskId === taskId
            );
            if (subtaskColumnIndex > 0) {
              taskManager.appState.closeSubtasksFromColumn(
                subtaskColumnIndex - 1
              );
            }
          });

          // Calculate the final order BEFORE making any changes
          const reorderedTasks = [...existingTargetTasks];
          reorderedTasks.splice(targetIndex, 0, ...tasksBeingMoved);

          // First, move tasks to the new parent (this adds them at the end)
          await taskManager.moveTasksToParent(
            draggedTaskIds,
            column?.parentTaskId
          );

          // Then immediately reorder all tasks in the target column to the desired order
          const finalTaskIds = reorderedTasks.map((task) => task.id);
          await taskManager.reorderTasks(finalTaskIds, column?.parentTaskId);

          // Update focus to follow the first moved task
          const newIndex = reorderedTasks.findIndex(
            (task) => task.id === tasksBeingMoved[0].id
          );
          if (newIndex >= 0) {
            taskManager.appState.setFocusedTaskIndex(newIndex);
            taskManager.appState.selectTask(
              tasksBeingMoved[0].id,
              columnIndex,
              newIndex
            );
          }
        } else {
          // Same-column reordering (original logic)

          // Get tasks that are not being dragged
          const nonDraggedTasks = columnTasks.filter(
            (task) => !draggedTaskIds.includes(task.id)
          );

          // Get dragged tasks in their original order
          const draggedTasks = draggedTasksInTargetColumn;

          // Create new order by inserting dragged tasks at target index
          const reorderedTasks = [...nonDraggedTasks];
          reorderedTasks.splice(targetIndex, 0, ...draggedTasks);

          // Update task order in database
          const newTaskIds = reorderedTasks.map((task) => task.id);
          await taskManager.reorderTasks(newTaskIds, column?.parentTaskId);

          // Update focus to follow the first dragged task
          if (draggedTasks.length > 0) {
            const newIndex = reorderedTasks.findIndex(
              (task) => task.id === draggedTasks[0].id
            );
            if (newIndex >= 0) {
              taskManager.appState.setFocusedTaskIndex(newIndex);
              taskManager.appState.selectTask(
                draggedTasks[0].id,
                columnIndex,
                newIndex
              );
            }
          }
        }

        // Clear selection after successful operation
        taskManager.appState.setSelectedTasks(new Set());
      } catch (error) {
        console.error("Failed to reorder tasks:", error);
      }
    },
    [taskManager]
  );

  // Show error state
  if (taskManager.error) {
    return (
      <div className="h-[calc(100vh-28px)] bg-neutral-50 dark:bg-neutral-950 relative mt-7 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400">
          Error: {taskManager.error}
        </div>
      </div>
    );
  }

  return (
    <DragProvider>
      <div
        className="h-[calc(100vh-28px)] bg-neutral-50 dark:bg-neutral-950 relative mt-7"
        onClick={handleBackgroundClick}
      >
        {/* Loading overlay */}
        {taskManager.loading && (
          <div className="fixed bottom-4 right-4 z-50">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-600 dark:text-neutral-400" />
          </div>
        )}

        {/* Fixed Date Filter Column */}
        <div className="fixed left-0 top-7 h-full z-10">
          <DateFilterColumn
            dateFilters={taskManager.dateFilters}
            selectedDateFilter={taskManager.selectedDateFilter}
            focusedDateIndex={taskManager.appState.focusedDateIndex}
            onDateFilterClick={handleDateFilterClick}
            onDateFilterDrop={handleDateFilterDrop}
          />
        </div>

        {/* Scrollable Task Columns */}
        <div
          ref={scrollContainerRef}
          className="h-full overflow-x-auto overflow-y-hidden ml-48"
          onClick={handleBackgroundClick}
        >
          <div className="flex h-full min-w-fit">
            {taskManager.appState.columns.map((column, columnIndex) => {
              const columnTasks = taskManager.getTasksByParentId(
                column.parentTaskId
              );

              return (
                <TaskColumn
                  key={`${column.level}-${column.parentTaskId || "root"}`}
                  column={column}
                  columnIndex={columnIndex}
                  tasks={columnTasks}
                  selectedTasks={taskManager.appState.selectedTasks}
                  selectedColumn={taskManager.appState.selectedColumn}
                  isTaskOpen={taskManager.appState.isTaskOpen}
                  getSubtaskCount={taskManager.getSubtaskCountFromState}
                  getAllSubtasks={taskManager.getAllSubtasks}
                  onColumnClick={handleColumnClick}
                  onTaskClick={handleTaskClick}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskToggle={taskManager.toggleTask}
                  onTaskDrop={handleTaskDrop}
                  onColumnDrop={handleColumnDrop}
                  onTaskReorder={handleTaskReorder}
                />
              );
            })}
          </div>
        </div>

        <ActionBar
          isOpen={taskManager.appState.isModalOpen}
          newTaskName={taskManager.appState.newTaskName}
          setNewTaskName={taskManager.appState.setNewTaskName}
          onAddTask={() => {
            if (!taskManager.appState.newTaskName.trim()) return;

            let parentTaskId: string | undefined;

            // If task(s) are selected, add as subtask of the first selected task
            if (taskManager.appState.selectedTasks.size > 0) {
              parentTaskId = Array.from(taskManager.appState.selectedTasks)[0];
            } else {
              // If no task selected, add to the current column
              parentTaskId =
                taskManager.appState.columns[
                  taskManager.appState.selectedColumn
                ]?.parentTaskId;
            }

            // Get date from selected filter
            const taskDate = getDateFromFilter(taskManager.selectedDateFilter);

            taskManager.addTask(
              taskManager.appState.newTaskName,
              parentTaskId,
              taskDate
            );
            taskManager.appState.closeModal();
          }}
          onClose={taskManager.appState.closeModal}
        />
      </div>
    </DragProvider>
  );
}

export default App;
