// transgui-ng - next gen remote GUI for transmission torrent daemon
// Copyright (C) 2022  qu1ck (mail at qu1ck.org)
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

use std::sync::Mutex;

use tauri::{
    AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, State,
};
#[derive(Default)]
pub struct HideStateHandle(pub Mutex<bool>);

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
    let main_window = app.get_window("main").unwrap();
    let tray = app.tray_handle();
    match event {
        SystemTrayEvent::LeftClick {
            position: _,
            size: _,
            ..
        } => {
            main_window.show().unwrap();
        }
        SystemTrayEvent::RightClick {
            position: _,
            size: _,
            ..
        } => {
            println!("system tray received a right click");
        }
        SystemTrayEvent::DoubleClick {
            position: _,
            size: _,
            ..
        } => {
            println!("system tray received a double click");
        }
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "quit" => {
                std::process::exit(0);
            }
            "showhide" => {
                let hidden_handle: State<HideStateHandle> = app.state();
                let mut hidden = hidden_handle.0.lock().unwrap();
                if *hidden {
                    main_window.show().unwrap();
                    tray.get_item(&id).set_title("Hide\0").ok();
                } else {
                    main_window.hide().unwrap();
                    tray.get_item(&id).set_title("Show\0").ok();
                }
                *hidden = !*hidden;
            }
            _ => {}
        },
        _ => {}
    }
}
