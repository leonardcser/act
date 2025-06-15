import React, { createContext, useContext, useState, ReactNode } from "react";

interface DragData {
  type: string;
  taskIds: string[];
  sourceColumnIndex: number;
}

interface DragContextType {
  currentDragData: DragData | null;
  setCurrentDragData: (data: DragData | null) => void;
}

const DragContext = createContext<DragContextType | undefined>(undefined);

export function DragProvider({ children }: { children: ReactNode }) {
  const [currentDragData, setCurrentDragData] = useState<DragData | null>(null);

  return (
    <DragContext.Provider value={{ currentDragData, setCurrentDragData }}>
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
