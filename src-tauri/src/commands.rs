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

#[derive(serde::Serialize)]
pub struct TorrentFileEntry {
    name: String,
    size: i64,
}
#[derive(serde::Serialize)]
pub struct TorrentReadResult {
    metadata: String,
    files: Vec<TorrentFileEntry>,
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<TorrentReadResult, String> {
    let metadata = std::fs::metadata(path.clone());
    match metadata {
        Err(_) => return Err("Failed to read file".to_string()),
        Ok(metadata) => {
            if metadata.file_size() > 10 * 1024 * 1024 {
                return Err("File is too large".to_string());
            }
        }
    }

    let read_result = tokio::fs::read(path).await;
    if let Err(_) = read_result {
        return Err("Failed to read file".to_string());
    }

    let torrent = Torrent::read_from_bytes(&read_result.as_ref().unwrap()[..]);
    if let Err(_) = torrent {
        return Err("Failed to parse torrent".to_string());
    }

    let b64 = b64engine.encode(read_result.unwrap());

    Ok(TorrentReadResult {
        metadata: b64,
        files: torrent.unwrap().files.map_or(Vec::new(), |v| {
            v.into_iter()
                .map(|f| TorrentFileEntry {
                    name: f.path.to_string_lossy().into(),
                    size: f.length,
                })
                .collect()
        }),
    })
}

#[tauri::command]
pub async fn shell_open(path: String) -> Result<(), String> {
    if let Err(e) = opener::open(path) {
        return Err(e.to_string())
    }
    Ok(())
}
