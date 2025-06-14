use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_tasks_table",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:act.db", migrations)
                .build()
        )
        .setup(|app| {
            // Create the .act directory in the user's home folder
            let act_dir = app.path().home_dir().expect("failed to get home dir").join(".act");
            if !act_dir.exists() {
                std::fs::create_dir_all(&act_dir).expect("failed to create .act directory");
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
