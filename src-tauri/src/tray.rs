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
    async_runtime,
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Listener, Manager, State, WebviewWindow, WebviewWindowBuilder,
};
use tokio::sync::oneshot;

use crate::ListenerHandle;

pub const TRAY_ID: &str = "tray";

pub fn create_tray(app: AppHandle) {
    let menu = create_menu(&app, "Hide");

    #[allow(clippy::single_match)]
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    #[cfg(not(target_os = "macos"))]
                    toggle_main_window(
                        tray.app_handle(),
                        tray.app_handle().get_webview_window("main"),
                    );
                }
                _ => {}
            };
        })
        .on_menu_event(on_menu_event)
        .build(&app)
        .ok();
}

fn create_menu<R>(app: &AppHandle<R>, showhide_text: &str) -> tauri::menu::Menu<R>
where
    R: tauri::Runtime,
{
    let hide = MenuItem::with_id(app, "showhide", showhide_text, true, None::<&str>).unwrap();
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
    let separator = PredefinedMenuItem::separator(app).unwrap();
    Menu::with_items(app, &[&hide, &separator, &quit]).unwrap()
}

pub fn set_tray_showhide_text(app: &AppHandle, text: &str) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(create_menu(app, text))).ok();
    }
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id.as_ref() {
        "quit" => {
            exit(app.clone());
        }
        "showhide" => {
            toggle_main_window(app, app.get_webview_window("main"));
        }
        _ => {}
    }
}

pub fn toggle_main_window(app: &AppHandle, window: Option<WebviewWindow>) {
    match window {
        Some(window) => {
            if !window.is_visible().unwrap() {
                window.show().ok();
                window.unminimize().ok();
                window.set_focus().ok();
                window.emit("window-shown", "").ok();
                set_tray_showhide_text(app, "Hide");
                return;
            }
            set_tray_showhide_text(app, "Show");
            async_runtime::spawn(async move {
                close_main(window).await;
            });
        }
        None => {
            let window =
                WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                    .build()
                    .unwrap();
            set_tray_showhide_text(app, "Hide");
            window.set_title("Transmission GUI").ok();
            window.set_focus().ok();
        }
    }
}

pub fn exit(app: AppHandle) {
    async_runtime::spawn(async move {
        if let Some(window) = app.get_webview_window("main") {
            close_main(window).await;
        }

        let listener_state: State<ListenerHandle> = app.state();
        let mut listener = listener_state.0.write().await;
        println!("Stopping");
        listener.stop();
        app.cleanup_before_exit();
        std::process::exit(0);
    });
}

async fn close_main(window: WebviewWindow) {
    let (tx, rx) = oneshot::channel::<()>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    window.listen("frontend-done", move |_| {
        if let Some(tx) = tx.lock().unwrap().take() {
            tx.send(()).ok();
        }
    });
    window.emit("exit-requested", ()).ok();
    rx.await.ok();
    window.destroy().ok();
}
