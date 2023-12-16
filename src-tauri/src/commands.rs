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

use base64::{engine::general_purpose::STANDARD as b64engine, Engine as _};
use font_loader::system_fonts;
use lava_torrent::torrent::v1::Torrent;
use tauri::{Manager, State};

use crate::{
    createtorrent::{CreateCheckResult, CreationRequestsHandle, TorrentCreateInfo},
    poller::PollerConfig,
    tray, PollerHandle,
};

#[derive(serde::Serialize)]
pub struct TorrentFileEntry {
    name: String,
    length: i64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentReadResult {
    torrent_path: String,
    metadata: String,
    name: String,
    length: i64,
    hash: String,
    files: Option<Vec<TorrentFileEntry>>,
    trackers: Vec<String>,
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<TorrentReadResult, String> {
    let metadata = std::fs::metadata(path.clone());
    match metadata {
        Err(_) => return Err(format!("Failed to read file {:?}", path)),
        Ok(metadata) => {
            if metadata.len() > 10 * 1024 * 1024 {
                return Err("File is too large".to_string());
            }
        }
    }

    let read_result = tokio::fs::read(path.clone()).await;
    if read_result.is_err() {
        return Err(format!("Failed to read file {:?}", path));
    }

    match Torrent::read_from_bytes(&read_result.as_ref().unwrap()[..]) {
        Err(_) => Err(format!("Failed to parse torrent {:?}", path)),
        Ok(torrent) => {
            let b64 = b64engine.encode(read_result.unwrap());
            let mut trackers = vec![];

            if let Some(announce_list) = torrent.announce_list.as_ref() {
                announce_list.iter().for_each(|urls| {
                    if !trackers.is_empty() {
                        trackers.push("".into());
                    }
                    urls.iter().for_each(|url| trackers.push(url.clone()));
                })
            } else if let Some(announce) = torrent.announce.as_ref() {
                trackers.push(announce.clone());
            }

            Ok(TorrentReadResult {
                torrent_path: path,
                metadata: b64,
                name: torrent.name.clone(),
                length: torrent.length,
                hash: torrent.info_hash(),
                files: torrent.files.map(|v| {
                    v.into_iter()
                        .map(|f| TorrentFileEntry {
                            name: f.path.to_string_lossy().into(),
                            length: f.length,
                        })
                        .collect()
                }),
                trackers,
            })
        }
    }
}

#[tauri::command]
pub async fn remove_file(path: String) {
    if path.to_lowercase().ends_with(".torrent") && std::fs::remove_file(path.clone()).is_err() {
        println!("Unable to remove file {}", path);
    }
}

#[tauri::command]
pub async fn shell_open(path: String, reveal: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let path = path.replace('/', "\\");

    if reveal {
        opener::reveal(path).map_err(|e| e.to_string())?
    } else {
        opener::open(path).map_err(|e| e.to_string())?
    }
    Ok(())
}

#[tauri::command]
pub async fn set_poller_config(
    poller_handle: State<'_, PollerHandle>,
    configs: Vec<PollerConfig>,
    toast: bool,
    sound: bool,
) -> Result<(), ()> {
    let mut poller = poller_handle.0.lock().await;
    poller.set_configs(configs, toast, sound);
    Ok(())
}

#[tauri::command]
pub async fn app_integration(mode: String) -> bool {
    crate::integrations::app_integration_impl(mode)
}

#[tauri::command]
pub async fn create_torrent(
    window: tauri::Window,
    creation_requests_handle: State<'_, CreationRequestsHandle>,
    info: TorrentCreateInfo,
) -> Result<(), String> {
    let label_split: Vec<&str> = window.label().split('-').collect();

    if label_split.len() != 2 {
        return Err("Incorrect window label".to_string());
    }

    let id = label_split[1]
        .parse::<i32>()
        .map_err(|_| "Incorrect window label".to_string())?;

    let mut requests = creation_requests_handle.0.lock().await;
    requests.add(id, info).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn check_create_torrent(
    window: tauri::Window,
    creation_requests_handle: State<'_, CreationRequestsHandle>,
) -> Result<CreateCheckResult, String> {
    let label_split: Vec<&str> = window.label().split('-').collect();

    if label_split.len() != 2 {
        return Err("Incorrect window label".to_string());
    }

    let id = label_split[1]
        .parse::<i32>()
        .map_err(|_| "Incorrect window label".to_string())?;

    let mut requests = creation_requests_handle.0.lock().await;

    Ok(requests.check(id))
}

#[tauri::command]
pub async fn cancel_create_torrent(
    window: tauri::Window,
    creation_requests_handle: State<'_, CreationRequestsHandle>,
) -> Result<(), String> {
    let label_split: Vec<&str> = window.label().split('-').collect();

    if label_split.len() != 2 {
        return Err("Incorrect window label".to_string());
    }

    let id = label_split[1]
        .parse::<i32>()
        .map_err(|_| "Incorrect window label".to_string())?;

    let mut requests = creation_requests_handle.0.lock().await;

    requests.cancel(id)
}

#[tauri::command]
pub async fn save_create_torrent(
    window: tauri::Window,
    creation_requests_handle: State<'_, CreationRequestsHandle>,
    path: String,
) -> Result<(), String> {
    let label_split: Vec<&str> = window.label().split('-').collect();

    if label_split.len() != 2 {
        return Err("Incorrect window label".to_string());
    }

    let id = label_split[1]
        .parse::<i32>()
        .map_err(|_| "Incorrect window label".to_string())?;

    let mut requests = creation_requests_handle.0.lock().await;

    requests.save(id, &path)
}

#[derive(serde::Serialize, Clone)]
struct PassEventData {
    from: String,
    payload: String,
}

#[tauri::command]
pub async fn pass_to_window(
    app_handle: tauri::AppHandle,
    window: tauri::Window,
    to: String,
    payload: String,
) {
    if let Some(dest) = app_handle.get_window(to.as_str()) {
        let _ = dest.emit(
            "pass-from-window",
            PassEventData {
                from: window.label().to_string(),
                payload,
            },
        );
    }
}

#[tauri::command]
pub async fn list_system_fonts() -> Vec<String> {
    system_fonts::query_all()
}

#[tauri::command]
pub async fn create_tray(app_handle: tauri::AppHandle) {
    if app_handle.tray_handle_by_id(tray::TRAY_ID).is_none() {
        tray::create_tray(app_handle.clone())
            .build(&app_handle)
            .ok();
    }
}
