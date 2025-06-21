import React from "react";
import { Calendar } from "lucide-react";
import { formatDateLabel } from "../utils/date";
import { cn } from "../utils";

interface DatePickerProps {
  value: string; // ISO date string
  onChange: (date: string) => void;
  isOverdue?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showIcon?: boolean;
}

export function DatePicker({
  value,
  onChange,
  isOverdue = false,
  placeholder = "Today",
  showIcon = false,
  disabled = false,
  className,
}: DatePickerProps) {
  const inputId = React.useRef(
    `date-picker-${Math.random().toString(36).substr(2, 9)}`
  );

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    const hiddenInput = document.getElementById(
      inputId.current
    ) as HTMLInputElement;
    hiddenInput?.showPicker();
  };

  return (
    <button
      type="button"
      onClick={handleButtonClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 transition-colors relative text-xs",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : isOverdue
          ? "text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 focus-within:text-red-500 dark:focus-within:text-red-300"
          : "text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:text-blue-500 dark:focus-within:text-blue-300",
        className
      )}
    >
      {showIcon && <Calendar size={14} />}
      <span className="whitespace-nowrap">
        {value ? formatDateLabel(new Date(value)) : placeholder}
      </span>

      <input
        id={inputId.current}
        type="date"
        value={value}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.value);
        }}
        disabled={disabled}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </button>
  );
}
