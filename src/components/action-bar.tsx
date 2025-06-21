import { useRef, useEffect, useState } from "react";
import { DatePicker } from "./date-picker";

interface ActionBarProps {
  isOpen: boolean;
  onAddTask: (taskName: string, dueDate: string) => void;
  onClose: () => void;
}

export function ActionBar({ isOpen, onAddTask, onClose }: ActionBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNewTaskName("");
      setNewTaskDueDate("");
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (newTaskName.trim()) {
        onAddTask(newTaskName.trim(), newTaskDueDate);
      }
    } else if (e.key === "Escape" && onClose) {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex justify-center p-6 z-50 bg-black/25 dark:bg-black/60">
      <div className="h-fit bg-white dark:bg-neutral-900 rounded-lg p-2 w-96 max-w-md mx-4 border border-neutral-200 dark:border-neutral-800 shadow-lg">
        <div className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter task name..."
              className="w-full px-3 py-2 pr-20 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <DatePicker
                value={newTaskDueDate}
                onChange={setNewTaskDueDate}
                placeholder="Today"
                showIcon={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
