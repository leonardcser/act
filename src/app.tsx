import { useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useTaskManager } from "./hooks/use-task-manager";
import { useKeyboard } from "./hooks/use-keyboard";
import { TaskColumn } from "./components/task-column";
import { ActionBar } from "./components/action-bar";
import { DateFilterColumn } from "./components/date-filter-column";
import { Task, DateFilter } from "./types";

function App() {
  const taskManager = useTaskManager();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useKeyboard({
    appState: taskManager.appState,
    taskOps: {
      tasks: taskManager.tasks,
      addTask: taskManager.addTask,
      toggleTask: taskManager.toggleTask,
      deleteMultipleTasks: taskManager.deleteMultipleTasks,
    },
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
    },
    [taskManager]
  );

  const handleTaskUpdate = useCallback(
    (task: Task, newName: string) => {
      taskManager.updateTaskName(task.id, newName);
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
                focusedColumn={taskManager.appState.focusedColumn}
                isTaskOpen={taskManager.appState.isTaskOpen}
                getSubtaskCount={taskManager.getSubtaskCountFromState}
                onColumnClick={handleColumnClick}
                onTaskClick={handleTaskClick}
                onTaskUpdate={handleTaskUpdate}
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
              taskManager.appState.columns[taskManager.appState.selectedColumn]
                ?.parentTaskId;
          }

          taskManager.addTask(taskManager.appState.newTaskName, parentTaskId);
          taskManager.appState.closeModal();
        }}
        onClose={taskManager.appState.closeModal}
      />
    </div>
  );
}

export default App;
