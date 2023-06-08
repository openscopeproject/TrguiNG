// TransguiNG - next gen remote GUI for transmission torrent daemon
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

#[cfg(target_os = "windows")]
use winreg::RegKey;

#[cfg(target_os = "windows")]
const APP_NAME: &str = "TransguiNG";

#[cfg(target_os = "windows")]
fn register_app_class() -> std::io::Result<()> {
    match std::env::current_exe() {
        Ok(exe) => {
            let exe = exe.to_str().unwrap_or_default();
            let hkcu = RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
            let (key, _) =
                hkcu.create_subkey(format!("SOFTWARE\\Classes\\{}\\DefaultIcon", APP_NAME))?;
            let icon = format!("\"{}\",0", exe);
            key.set_value("", &icon)?;

            let (key, _) = hkcu.create_subkey(format!(
                "SOFTWARE\\Classes\\{}\\shell\\open\\command",
                APP_NAME
            ))?;
            let icon = format!("\"{}\" \"%1\"", exe);
            key.set_value("", &icon)?;
        }
        Err(e) => println!("Error getting exe path: {}", e),
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn register_torrent_class() -> std::io::Result<()> {
    let hkcu = RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey("SOFTWARE\\Classes\\.torrent")?;
    key.set_value("", &APP_NAME)?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn register_magnet_class() -> std::io::Result<()> {
    match std::env::current_exe() {
        Ok(exe) => {
            let exe = exe.to_str().unwrap_or_default();
            let hkcu = RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
            let (key, _) = hkcu.create_subkey("SOFTWARE\\Classes\\Magnet")?;
            key.set_value("", &"Magnet URI")?;
            key.set_value("Content Type", &"application/x-magnet")?;
            key.set_value("URL Protocol", &"")?;

            let (key, _) = hkcu.create_subkey("SOFTWARE\\Classes\\Magnet\\DefaultIcon")?;
            let icon = format!("\"{}\",0", exe);
            key.set_value("", &icon)?;

            let (key, _) = hkcu.create_subkey("SOFTWARE\\Classes\\Magnet\\shell")?;
            key.set_value("", &"open")?;

            let (key, _) = hkcu.create_subkey("SOFTWARE\\Classes\\Magnet\\shell\\open\\command")?;
            let icon = format!("\"{}\" \"%1\"", exe);
            key.set_value("", &icon)?;
        }
        Err(e) => println!("Error getting exe path: {}", e),
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn register_autorun(run: bool) -> std::io::Result<()> {
    match std::env::current_exe() {
        Ok(exe) => {
            let exe = format!("\"{}\"", exe.to_str().unwrap_or_default());
            let hkcu = RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
            let (key, _) =
                hkcu.create_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run")?;
            if run {
                key.set_value(APP_NAME, &exe)?;
            } else {
                key.delete_value(APP_NAME)?;
            }
        }
        Err(e) => println!("Error getting exe path: {}", e),
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn check_autorun() -> bool {
    match std::env::current_exe() {
        Ok(exe) => {
            let exe = format!("\"{}\"", exe.to_str().unwrap_or_default());
            let hkcu = RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
            if let Ok((key, _)) =
                hkcu.create_subkey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run")
            {
                if let Ok(val) = key.get_value::<String, &str>(APP_NAME) {
                    return val == exe;
                }
            }
        }
        Err(e) => println!("Error getting exe path: {}", e),
    }
    false
}

#[cfg(target_os = "windows")]
pub fn app_integration_impl(mode: String) -> bool {
    match mode.as_str() {
        "torrent" => {
            println!("Associating .torrent files with the app");
            if let Err(e) = register_app_class() {
                println!("Error writing to registry: {}", e);
            }
            if let Err(e) = register_torrent_class() {
                println!("Error writing to registry: {}", e);
            }
        }
        "magnet" => {
            println!("Associating magnet links with the app");
            if let Err(e) = register_app_class() {
                println!("Error writing to registry: {}", e);
            }
            if let Err(e) = register_magnet_class() {
                println!("Error writing to registry: {}", e);
            }
        }
        "autostart" => {
            println!("Adding app to auto start");
            if let Err(e) = register_autorun(true) {
                println!("Error writing to registry: {}", e);
            }
        }
        "noautostart" => {
            println!("Removing app from auto start");
            if let Err(e) = register_autorun(false) {
                println!("Error writing to registry: {}", e);
            }
        }
        "getautostart" => {
            println!("Checking auto start");
            return check_autorun();
        }
        _ => {
            println!("Bad app_integration call");
        }
    }
    false
}

#[cfg(not(target_os = "windows"))]
pub fn app_integration_impl(_mode: String) -> bool {
    false
}
