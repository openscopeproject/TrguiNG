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

// Based on https://github.com/FabianLars/tauri-plugin-deep-link

use std::{
    fs::OpenOptions,
    io::Write,
};

use tauri::{menu::{Menu, MenuItem, PredefinedMenuItem, Submenu}, AppHandle};

// kAEOpenDocuments
const EVENT_OPEN_DOCUMENTS: u32 = 0x6F646F63;
// kAEGetURL
const EVENT_GET_URL: u32 = 0x4755524c;

fn log_event(event_id: u32, payload: &[String]) {
    let Some(path) = dirs::home_dir().map(|home| home.join("trgui.log")) else {
        return;
    };

    if let Ok(mut log) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(log, "event_id={event_id:#010x} payload={payload:?}");
    }
}

pub fn log_opened_urls(urls: &[String]) {
    let event_id = if urls.first().is_some_and(|url| url.starts_with("file:")) {
        EVENT_OPEN_DOCUMENTS
    } else {
        EVENT_GET_URL
    };
    log_event(event_id, urls);
}

pub fn make_menu<R>(app: &AppHandle<R>) -> tauri::Result<Menu<R>>
where
    R: tauri::Runtime,
{
    let app_name = app.config().product_name.as_ref().unwrap();

    Menu::with_items(app, &[
        &Submenu::with_items(app, app_name.as_str(), true, &[
            &PredefinedMenuItem::close_window(app, "Close".into())?,
            &MenuItem::with_id(app, "appquit", "Quit", true, "Cmd+q".into())?,
        ])?,
        &Submenu::with_items(app, "Edit", true, &[
            &PredefinedMenuItem::select_all(app, "Select All".into())?,
            &PredefinedMenuItem::cut(app, "Cut".into())?,
            &PredefinedMenuItem::copy(app, "Copy".into())?,
            &PredefinedMenuItem::paste(app, "Paste".into())?,
        ])?,
        &Submenu::with_items(app, "View", true, &[
            &PredefinedMenuItem::fullscreen(app, "Full Screen".into())?
        ])?,
        &Submenu::with_items(app, "Window", true, &[
            &PredefinedMenuItem::minimize(app, "Minimize".into())?,
            // zoom missing ??
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, "Close".into())?,
        ])?,
    ])
}
