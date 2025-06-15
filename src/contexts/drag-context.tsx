import React, { createContext, useContext, useState, ReactNode } from "react";

interface DragData {
  type: string;
  taskIds: string[];
  sourceColumnIndex: number;
}

interface DragContextType {
  currentDragData: DragData | null;
  setCurrentDragData: (data: DragData | null) => void;

  // Drag validation utilities
  canDropOnTask: (
    targetTaskId: string,
    getAllSubtasks: (id: string) => any[]
  ) => boolean;
  canDropInColumn: (
    columnParentTaskId: string | undefined,
    getAllSubtasks: (id: string) => any[]
  ) => boolean;

  // Position calculation utilities
  calculateDropPosition: (
    e: React.DragEvent,
    taskHeight?: number
  ) => {
    isHoveringEdge: boolean;
    isHoveringTopEdge: boolean;
    isHoveringBottomEdge: boolean;
    position: "above" | "below";
  };

  // Drop effect utilities
  getDropEffect: (
    isSameColumn: boolean,
    canDrop: boolean,
    isEdgeHover?: boolean
  ) => "move" | "copy" | "none";
}

const DragContext = createContext<DragContextType | undefined>(undefined);

export function DragProvider({ children }: { children: ReactNode }) {
  const [currentDragData, setCurrentDragData] = useState<DragData | null>(null);

  // Check if dragging a task to target would create a cycle
  const wouldCreateCycle = (
    draggedTaskId: string,
    targetTaskId: string,
    getAllSubtasks: (id: string) => any[]
  ): boolean => {
    if (draggedTaskId === targetTaskId) return true;

    // Check if target is a descendant of the dragged task
    const allSubtasks = getAllSubtasks(draggedTaskId);
    return allSubtasks.some((subtask) => subtask.id === targetTaskId);
  };

  const canDropOnTask = (
    targetTaskId: string,
    getAllSubtasks: (id: string) => any[]
  ) => {
    if (!currentDragData || currentDragData.type !== "tasks") return false;

    // Don't allow dropping on dragged tasks themselves
    if (currentDragData.taskIds.includes(targetTaskId)) return false;

    // Check if this would create a cycle
    return !currentDragData.taskIds.some((taskId: string) =>
      wouldCreateCycle(taskId, targetTaskId, getAllSubtasks)
    );
  };

  const canDropInColumn = (
    columnParentTaskId: string | undefined,
    getAllSubtasks: (id: string) => any[]
  ) => {
    if (!currentDragData || currentDragData.type !== "tasks") return false;

    // If this column represents subtasks of a task, check for cycles
    if (columnParentTaskId) {
      return !currentDragData.taskIds.some((draggedTaskId) => {
        // Direct cycle: dragging a task into its own subtask column
        if (draggedTaskId === columnParentTaskId) return true;

        // Indirect cycle: check if the column's parent would become a descendant of the dragged task
        const allSubtasks = getAllSubtasks(draggedTaskId);
        return allSubtasks.some((subtask) => subtask.id === columnParentTaskId);
      });
    }

    return true;
  };

  const calculateDropPosition = (e: React.DragEvent, taskHeight?: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    const taskTop = rect.top;
    const taskBottom = rect.bottom;
    const actualTaskHeight = taskHeight || rect.height;
    const edgeThreshold = Math.min(actualTaskHeight * 0.25, 12);

    const isHoveringTopEdge = mouseY < taskTop + edgeThreshold;
    const isHoveringBottomEdge = mouseY > taskBottom - edgeThreshold;
    const isHoveringEdge = isHoveringTopEdge || isHoveringBottomEdge;
    const position: "above" | "below" = isHoveringTopEdge ? "above" : "below";

    return {
      isHoveringEdge,
      isHoveringTopEdge,
      isHoveringBottomEdge,
      position,
    };
  };

  const getDropEffect = (
    isSameColumn: boolean,
    canDrop: boolean,
    isEdgeHover?: boolean
  ): "move" | "copy" | "none" => {
    if (!canDrop) return "none";

    // Use copy icon for date filter drops
    if (!isSameColumn && isEdgeHover === undefined) return "copy";

    // Use move for task/column operations
    return "move";
  };

  return (
    <DragContext.Provider
      value={{
        currentDragData,
        setCurrentDragData,
        canDropOnTask,
        canDropInColumn,
        calculateDropPosition,
        getDropEffect,
      }}
    >
      {children}
    </DragContext.Provider>
  );
}

export function useDrag() {
  const context = useContext(DragContext);
  if (context === undefined) {
    throw new Error("useDrag must be used within a DragProvider");
  }
  return context;
}
