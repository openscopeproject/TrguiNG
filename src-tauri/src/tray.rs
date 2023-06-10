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

use std::sync::{Arc, Mutex};

use tauri::{
    async_runtime, AppHandle, CustomMenuItem, Manager, State, SystemTray, SystemTrayEvent,
    SystemTrayMenu, SystemTrayMenuItem, Window, WindowBuilder,
};
use tokio::sync::oneshot;

use crate::ListenerHandle;

pub fn create_tray() -> SystemTray {
    let hide = CustomMenuItem::new("showhide".to_string(), "Hide");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let tray_menu = SystemTrayMenu::new()
        .add_item(hide)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    SystemTray::new().with_menu(tray_menu)
}

pub fn on_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    let main_window = app.get_window("main");
    match event {
        SystemTrayEvent::LeftClick { .. } => {
            if let Some(window) = main_window.as_ref() {
                if !window.is_visible().unwrap() {
                    window.show().ok();
                    window.unminimize().ok();
                    window.set_focus().ok();
                    window.emit("window-shown", "").ok();
                    return;
                }
            }
            toggle_main_window(app.clone(), main_window);
        }
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "quit" => {
                exit(app.clone());
            }
            "showhide" => {
                toggle_main_window(app.clone(), main_window);
            }
            _ => {}
        },
        _ => {}
    }
}

pub fn toggle_main_window(app: AppHandle, window: Option<Window>) {
    match window {
        Some(window) => {
            app.tray_handle()
                .get_item("showhide")
                .set_title("Show")
                .ok();
            async_runtime::spawn(async move {
                close_main(window).await;
            });
        }
        None => {
            let window =
                WindowBuilder::new(&app, "main", tauri::WindowUrl::App("index.html".into()))
                    .build()
                    .unwrap();
            app.tray_handle()
                .get_item("showhide")
                .set_title("Hide")
                .ok();
            window.set_title("Transmission Remote GUI").ok();
            window.set_focus().ok();
        }
    }
}

fn exit(app: AppHandle) {
    async_runtime::spawn(async move {
        if let Some(window) = app.get_window("main") {
            close_main(window).await;
        }

        let listener_state: State<ListenerHandle> = app.state();
        let mut listener = listener_state.0.write().await;
        println!("Stopping");
        listener.stop();
        app.exit(0);
    });
}

async fn close_main(window: Window) {
    let (tx, rx) = oneshot::channel::<()>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    window.listen("frontend-done", move |_| {
        if let Some(tx) = tx.lock().unwrap().take() {
            tx.send(()).ok();
        }
    });
    window.emit("exit-requested", ()).ok();
    rx.await.ok();
    window.close().ok();
}
