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

use crate::i18n;

use tauri::{menu::{Menu, MenuItem, PredefinedMenuItem, Submenu}, AppHandle};

pub fn make_menu<R>(app: &AppHandle<R>) -> tauri::Result<Menu<R>>
where
    R: tauri::Runtime,
{
    let app_name = app.config().product_name.as_ref().unwrap();

    Menu::with_items(app, &[
        &Submenu::with_items(app, app_name.as_str(), true, &[
            &PredefinedMenuItem::close_window(app, Some(i18n::text(app, "modals.common.close").as_str()))?,
            &MenuItem::with_id(app, "appquit", i18n::text(app, "native.quit"), true, "Cmd+q".into())?,
        ])?,
        &Submenu::with_items(app, i18n::text(app, "native.edit"), true, &[
            &PredefinedMenuItem::select_all(app, Some(i18n::text(app, "native.selectAll").as_str()))?,
            &PredefinedMenuItem::cut(app, Some(i18n::text(app, "native.cut").as_str()))?,
            &PredefinedMenuItem::copy(app, Some(i18n::text(app, "native.copy").as_str()))?,
            &PredefinedMenuItem::paste(app, Some(i18n::text(app, "native.paste").as_str()))?,
        ])?,
        &Submenu::with_items(app, i18n::text(app, "native.view"), true, &[
            &PredefinedMenuItem::fullscreen(app, Some(i18n::text(app, "native.fullScreen").as_str()))?
        ])?,
        &Submenu::with_items(app, i18n::text(app, "native.window"), true, &[
            &PredefinedMenuItem::minimize(app, Some(i18n::text(app, "native.minimize").as_str()))?,
            // zoom missing ??
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some(i18n::text(app, "modals.common.close").as_str()))?,
        ])?,
    ])
}
