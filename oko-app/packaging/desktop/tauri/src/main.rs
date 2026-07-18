// OKO desktop shell (Tauri v2).
// The window loads the live OKO web app (see tauri.conf.json -> app.windows[0].url).
// For an OFFLINE build, point that url at "index.html" and copy the prototype into ./dist
// (see build-desktop.md).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running OKO");
}
