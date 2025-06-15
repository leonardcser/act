use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_tasks_table",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_order_column",
            sql: include_str!("../migrations/002_add_order.sql"),
            kind: MigrationKind::Up,
        },
    ];

    // Determine the database path before building the app
    let home_dir = dirs::home_dir().expect("failed to get home directory");
    let act_dir = home_dir.join(".act");
    let db_file = act_dir.join("act.db");
    let db_url = format!("sqlite:{}", db_file.to_string_lossy());

    tauri::Builder::default()
        .setup(move |_app| {
            // Create the .act directory in the user's home folder
            if !act_dir.exists() {
                std::fs::create_dir_all(&act_dir).expect("failed to create .act directory");
            }
            
            Ok(())
        })
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .build()
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
