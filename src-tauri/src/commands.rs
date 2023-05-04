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
use std::os::windows::fs::MetadataExt;

use base64::{engine::general_purpose::STANDARD as b64engine, Engine as _};
use lava_torrent::torrent::v1::Torrent;
use tauri::State;

use crate::{poller::PollerConfig, PollerHandle};

#[derive(serde::Serialize)]
pub struct TorrentFileEntry {
    name: String,
    length: i64,
}
#[derive(serde::Serialize)]
pub struct TorrentReadResult {
    metadata: String,
    name: String,
    length: i64,
    files: Option<Vec<TorrentFileEntry>>,
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<TorrentReadResult, String> {
    let metadata = std::fs::metadata(path.clone());
    match metadata {
        Err(_) => return Err(format!("Failed to read file {:?}", path)),
        Ok(metadata) => {
            if metadata.file_size() > 10 * 1024 * 1024 {
                return Err("File is too large".to_string());
            }
        }
    }

    let read_result = tokio::fs::read(path.clone()).await;
    if let Err(_) = read_result {
        return Err(format!("Failed to read file {:?}", path));
    }

    match Torrent::read_from_bytes(&read_result.as_ref().unwrap()[..]) {
        Err(_) => Err(format!("Failed to parse torrent {:?}", path)),
        Ok(torrent) => {
            let b64 = b64engine.encode(read_result.unwrap());

            Ok(TorrentReadResult {
                metadata: b64,
                name: torrent.name,
                length: torrent.length,
                files: torrent.files.map(|v| {
                    v.into_iter()
                        .map(|f| TorrentFileEntry {
                            name: f.path.to_string_lossy().into(),
                            length: f.length,
                        })
                        .collect()
                }),
            })
        }
    }
}

#[tauri::command]
pub async fn shell_open(path: String) -> Result<(), String> {
    if let Err(e) = opener::open(path) {
        return Err(e.to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn set_poller_config(
    poller_handle: State<'_, PollerHandle>,
    configs: Vec<PollerConfig>,
) -> Result<(), ()> {
    let mut poller = poller_handle.0.lock().await;
    poller.set_configs(&configs);
    Ok(())
}
