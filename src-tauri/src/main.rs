// TrguiNG - next gen remote GUI for transmission torrent daemon
// Copyright (C) 2023  qu1ck (mail at qu1ck.org)
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Arc;

use createtorrent::CreationRequestsHandle;
use geoip::MmdbReaderHandle;
use poller::PollerHandle;
use tauri::{async_runtime, App, AppHandle, Emitter, Listener, Manager, State};
use tauri_plugin_cli::CliExt;
use tokio::sync::RwLock;
use torrentcache::TorrentCacheHandle;

mod commands;
mod createtorrent;
mod geoip;
mod integrations;
mod ipc;
#[cfg(target_os = "macos")]
mod macos;
mod poller;
mod sound;
mod torrentcache;
mod tray;

struct ListenerHandle(Arc<RwLock<ipc::Ipc>>);

#[cfg(target_os = "macos")]
fn handle_uris(app: AppHandle, uris: Vec<String>) {
    let listener_state: State<ListenerHandle> = app.state();
    let listener_lock = listener_state.0.clone();
    let app_handle = Arc::new(app.clone());
    async_runtime::spawn(async move {
        let listener = listener_lock.read().await;
        if let Err(e) = listener.send(&uris, app_handle).await {
            println!("Unable to send args to listener: {:?}", e);
        }
    });
}

fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    {
        let app_handle = app.handle();
        macos::set_handler(move |uris| {
            handle_uris(app_handle.clone(), uris);
        })
        .expect("Unable to set apple event handler");
        macos::listen_url();
    }

    let mut torrents: Vec<String> = vec![];
    match app.cli().matches() {
        Ok(matches) => {
            if matches.args.contains_key("help") {
                println!("{}", matches.args["help"].value.as_str().unwrap());
                app.handle().exit(0);
                return Ok(());
            }

            if matches.args["torrent"].value.is_array() {
                torrents = matches.args["torrent"]
                    .value
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| v.as_str().unwrap().to_string())
                    .collect();
            }
        }
        Err(_) => {
            println!("Unable to read cli args");
            app.handle().exit(0);
        }
    }

    let app: AppHandle = app.handle().clone();

    async_runtime::spawn(async move {
        let poller_state: State<PollerHandle> = app.state();
        let mut poller = poller_state.0.lock().await;
        poller.set_app_handle(&app);

        let listener_state: State<ListenerHandle> = app.state();
        let listener_lock = listener_state.0.clone();

        let mut listener = listener_lock.write().await;
        listener.init().await;
        listener.listen(&app).await.ok();

        if listener.listening {
            let listener_lock1 = listener_lock.clone();
            let _ = app.listen("listener-start", move |_| {
                let listener_lock = listener_lock1.clone();
                async_runtime::spawn(async move {
                    let mut listener = listener_lock.write().await;
                    listener.start();
                });
            });
            let listener_lock2 = listener_lock.clone();
            let _ = app.listen("listener-pause", move |_| {
                let listener_lock = listener_lock2.clone();
                async_runtime::spawn(async move {
                    let mut listener = listener_lock.write().await;
                    listener.pause().await;
                });
            });
            let main_window = app.get_webview_window("main").unwrap();
            main_window.show().ok();
            main_window.emit("window-shown", "").ok();
        }
        drop(listener);

        let app_clone = app.clone();
        async_runtime::spawn(async move {
            let listener = listener_lock.read().await;
            if let Err(e) = listener.send(&torrents, app_clone).await {
                println!("Unable to send args to listener: {:?}", e);
            }

            #[cfg(target_os = "macos")]
            {
                macos::listen_open_documents();
                macos::listen_reopen_app();
            }
        });

        let app_clone = app.clone();
        app.listen("app-exit", move |_| {
            println!("Exiting");
            app_clone.cleanup_before_exit();
            std::process::exit(0);
        });

        let app_clone = app.clone();
        app.listen("window-hidden", move |_| {
            tray::set_tray_showhide_text(&app_clone, "Show");
        })
    });

    Ok(())
}

fn main() {
    let mut ipc = ipc::Ipc::new();
    ipc.try_bind();

    let context = tauri::generate_context!();

    let app_builder = tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::remove_file,
            commands::shell_open,
            commands::set_poller_config,
            commands::app_integration,
            commands::create_torrent,
            commands::check_create_torrent,
            commands::cancel_create_torrent,
            commands::save_create_torrent,
            commands::pass_to_window,
            commands::list_system_fonts,
            commands::create_tray,
            commands::save_text_file,
            commands::load_text_file,
        ])
        .manage(ListenerHandle(Arc::new(RwLock::new(ipc))))
        .manage(TorrentCacheHandle::default())
        .manage(PollerHandle::default())
        .manage(MmdbReaderHandle::default())
        .manage(CreationRequestsHandle::default())
        .setup(setup);

    #[cfg(target_os = "macos")]
    let app_builder = app_builder
        .menu(macos::make_menu(
            context.config().package.product_name.as_ref().unwrap(),
        ))
        .on_menu_event(|event| match event.menu_item_id() {
            "quit" => {
                tray::exit(event.window().app_handle());
            }
            _ => {}
        });

    let app = app_builder
        .build(context)
        .expect("error while running tauri application");

    #[allow(clippy::single_match)]
    app.run(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            api.prevent_exit();
            tray::set_tray_showhide_text(app_handle, "Show");
        }
        _ => {}
    });
}
