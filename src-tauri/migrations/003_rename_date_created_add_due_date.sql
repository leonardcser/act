-- Rename date_created to created_at and add due_date
-- Enable foreign key constraints to ensure referential integrity
PRAGMA foreign_keys = ON;

-- Step 1: Add the new columns as nullable first (SQLite doesn't support non-constant defaults with NOT NULL)
ALTER TABLE tasks ADD COLUMN created_at TEXT;
ALTER TABLE tasks ADD COLUMN due_date TEXT;

-- Step 2: Copy date_created values to both created_at and due_date
UPDATE tasks SET created_at = date_created;
UPDATE tasks SET due_date = date_created;

-- Step 3: Disable foreign key constraints temporarily for table recreation
PRAGMA foreign_keys = OFF;

-- Step 4: Create new table with desired schema including NOT NULL constraints
CREATE TABLE tasks_new (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TEXT,
    task_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    due_date TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES tasks_new (id) ON DELETE CASCADE
);

-- Step 5: Copy all data to new table (preserving all relationships)
INSERT INTO tasks_new (id, name, parent_id, completed, completed_at, task_order, created_at, due_date)
SELECT id, name, parent_id, completed, completed_at, task_order, created_at, due_date FROM tasks;

-- Step 6: Drop old table and rename new table
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

-- Step 7: Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Step 8: Recreate indexes
CREATE INDEX idx_tasks_parent_id ON tasks (parent_id);
CREATE INDEX idx_tasks_completed ON tasks (completed);
CREATE INDEX idx_tasks_parent_order ON tasks (parent_id, task_order);
CREATE INDEX idx_tasks_created_at ON tasks (created_at);
CREATE INDEX idx_tasks_due_date ON tasks (due_date); 