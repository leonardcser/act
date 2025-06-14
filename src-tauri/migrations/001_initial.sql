CREATE TABLE tasks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TEXT,
    date_created TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_parent_id ON tasks (parent_id);
CREATE INDEX idx_tasks_completed ON tasks (completed);
CREATE INDEX idx_tasks_date_created ON tasks (date_created); 