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

use std::{collections::HashMap, sync::Arc};

use serde::Deserialize;
use tauri::{
    async_runtime::{self, Mutex},
    AppHandle, Manager, State,
};
use tauri_plugin_notification::NotificationExt;

use crate::sound::play_ping;

#[derive(Deserialize, Debug)]
struct Torrent {
    id: i64,
    name: String,
    status: i64,
}

#[derive(Deserialize, Debug, Default)]
#[serde(default)]
struct Arguments {
    torrents: Vec<Torrent>,
}

#[derive(Deserialize, Debug, Default)]
#[serde(default)]
struct ServerResponse {
    result: String,
    arguments: Option<Arguments>,
}

#[derive(Default)]
pub struct TorrentCache {
    server_data: HashMap<String, HashMap<i64, Torrent>>,
}

#[derive(Default)]
pub struct TorrentCacheHandle(Arc<Mutex<TorrentCache>>);

pub async fn process_response(
    app: &AppHandle,
    response: &[u8],
    original_url: &str,
    toast: bool,
    sound: bool,
) -> Result<(), String> {
    match serde_json::from_slice::<ServerResponse>(response) {
        Ok(server_response) => {
            if server_response.result != "success" {
                println!("Server returned error {}", server_response.result);
            }
            match server_response.arguments {
                Some(Arguments { torrents }) => {
                    process_torrents(app, torrents, original_url, toast, sound).await;
                }
                None => println!("Server returned success but no arguments!"),
            }
        }
        Err(e) => println!("Failed to parse server response {e:?}"),
    };

    Ok(())
}

async fn process_torrents(
    app: &AppHandle,
    mut torrents: Vec<Torrent>,
    original_url: &str,
    toast: bool,
    sound: bool,
) {
    // This is a hacky way to determine if details of a single torrent were
    // requested or a full update. Proper way would be to inspect the request.
    let partial_update = torrents.len() <= 1;

    let mut map = HashMap::<i64, Torrent>::new();

    torrents.drain(..).for_each(|t| {
        map.insert(t.id, t);
    });

    let cache_handle: State<TorrentCacheHandle> = app.state();
    let mut cache = cache_handle.0.lock().await;

    if let Some(old_map) = cache.server_data.get::<str>(original_url) {
        let mut play_sound = false;
        old_map.iter().for_each(|(id, old_torrent)| {
            if let Some(new_torrent) = map.get(id) {
                // If status switches from downloading (4) to seeding (6) or queued to seed (5)
                // then show a "download complete" notification.
                // Also check that torrent name is still the same just in case there was a restart
                // since the last pull and the torrent ids are reassigned.
                if new_torrent.name == old_torrent.name
                    && new_torrent.status > 4
                    && old_torrent.status == 4
                {
                    play_sound = sound;
                    if toast {
                        show_notification(app, new_torrent.name.as_str());
                    }
                }
            } else if partial_update {
                map.insert(
                    *id,
                    Torrent {
                        id: *id,
                        name: old_torrent.name.clone(),
                        status: old_torrent.status,
                    },
                );
            }
        });
        if play_sound {
            async_runtime::spawn_blocking(play_ping);
        }
    }

    cache.server_data.insert(original_url.into(), map);
}

fn show_notification(app: &AppHandle, name: &str) {
    if let Err(e) = app
        .notification()
        .builder()
        .title("Download complete")
        .body(name)
        .show()
    {
        println!("Cannot show notification: {e:?}");
    }
}
