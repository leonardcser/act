-- Add order column to tasks table
ALTER TABLE tasks ADD COLUMN task_order INTEGER NOT NULL DEFAULT 0;

-- Create index for task order within parent groups
CREATE INDEX idx_tasks_parent_order ON tasks (parent_id, task_order);
