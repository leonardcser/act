import { useRef, useEffect } from "react";

interface ActionBarProps {
  isOpen: boolean;
  newTaskName: string;
  setNewTaskName: (name: string) => void;
  onAddTask: () => void;
  onClose: () => void;
}

export function ActionBar({
  isOpen,
  newTaskName,
  setNewTaskName,
  onAddTask,
  onClose,
}: ActionBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAddTask();
    } else if (e.key === "Escape" && onClose) {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex justify-center p-6 z-50 bg-black/25 dark:bg-black/60">
      <div className="h-fit bg-white dark:bg-neutral-900 rounded-lg p-2 w-96 max-w-md mx-4 border border-neutral-200 dark:border-neutral-800 shadow-lg">
        <input
          ref={inputRef}
          type="text"
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter task name..."
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
        />
      </div>
    </div>
  );
}
