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

use tauri::{menu::{Menu, MenuItem, PredefinedMenuItem, Submenu}, AppHandle};

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
