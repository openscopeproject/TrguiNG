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

#[cfg(target_os = "windows")]
pub fn app_integration_impl(mode: String) -> bool {
    match mode.as_str() {
        "torrent" => {
            // TODO associate .torrent files
            println!("Associating .torrent files with the app");
        }
        "magnet" => {
            // TODO associate magnet links
            println!("Associating magnet links with the app");
        }
        "autostart" => {
            // TODO
            println!("Adding app to auto start");
        }
        "noautostart" => {
            // TODO
            println!("Removing app from auto start");
        }
        "getautostart" => {
            // TODO
            println!("Checking auto start");
            return true;
        }
        _ => {
            println!("Bad app_integration call");
        }
    }
    false
}

#[cfg(not(target_os = "windows"))]
pub fn app_integration_impl(mode: String) {
    false;
}
