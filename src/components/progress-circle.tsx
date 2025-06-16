import { cn } from "../utils";
import { Checkmark } from "./checkmark";

interface ProgressCircleProps {
  total: number;
  completed: number;
  isCompleted?: boolean;
  isSelected?: boolean;
  isOpen?: boolean;
  size?: number;
  className?: string;
}

export function ProgressCircle({
  total,
  completed,
  isCompleted,
  isSelected,
  isOpen,
  size = 36,
  className,
}: ProgressCircleProps) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const isFullyCompleted = completed === total && total > 0;

  return (
    <div
      className={cn("relative", className)}
      style={{ width: size, height: size }}
    >
      <svg className="size-full" viewBox="0 0 36 36">
        {/* Background circle */}
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className={cn(
            "opacity-20",
            isCompleted
              ? "text-green-500 dark:text-green-400"
              : isSelected
              ? "text-blue-500 dark:text-blue-400"
              : isOpen
              ? "text-neutral-500 dark:text-neutral-400"
              : "text-neutral-300 dark:text-neutral-600"
          )}
        />
        {/* Progress arc */}
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${progress} 100`}
          strokeDashoffset="0"
          strokeLinecap="round"
          className={cn(
            "transform -rotate-90 origin-center transition-all duration-300",
            isCompleted
              ? "text-green-500 dark:text-green-400"
              : isSelected
              ? "text-blue-500 dark:text-blue-400"
              : isOpen
              ? "text-neutral-500 dark:text-neutral-400"
              : "text-neutral-300 dark:text-neutral-600"
          )}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {isFullyCompleted ? (
          <Checkmark
            isCompleted={true}
            isSelected={isSelected}
            isOpen={isOpen}
            size={10}
          />
        ) : (
          <span
            className={cn(
              "text-xs font-bold",
              isCompleted
                ? "text-green-600 dark:text-green-400"
                : isSelected
                ? "text-blue-700 dark:text-blue-300"
                : isOpen
                ? "text-neutral-700 dark:text-neutral-300"
                : "text-neutral-500 dark:text-neutral-400"
            )}
          >
            {total - completed}
          </span>
        )}
      </div>
    </div>
  );
}
