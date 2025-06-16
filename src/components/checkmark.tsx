import { cn } from "../utils";

interface CheckmarkProps {
  isCompleted: boolean;
  isSelected?: boolean;
  isOpen?: boolean;
  size?: number;
  className?: string;
}

export function Checkmark({
  isCompleted,
  isSelected,
  isOpen,
  size = 10,
  className,
}: CheckmarkProps) {
  if (!isCompleted) return null;

  return (
    <svg
      width={size}
      height={size - 2}
      viewBox="0 0 10 8"
      fill="none"
      className={cn(
        "text-green-500 dark:text-green-400",
        isCompleted
          ? "text-green-500 dark:text-green-400"
          : isSelected
          ? "text-blue-500 dark:text-blue-400"
          : isOpen
          ? "text-neutral-500 dark:text-neutral-400"
          : "text-neutral-300 dark:text-neutral-600",
        className
      )}
    >
      <path
        d="M9 1L3.5 6.5L1 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
