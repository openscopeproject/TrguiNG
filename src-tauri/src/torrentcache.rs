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

use hyper::{body::to_bytes, Body, Response};
use serde::Deserialize;
use tauri::{
    // api::notification::Notification,
    async_runtime::{self, Mutex},
    AppHandle, Manager, State,
};

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
    response: Response<Body>,
    toast: bool,
) -> hyper::Result<Response<Body>> {
    let status = response.status();
    let headers = response.headers().clone();
    let original_url = headers.get("X-Original-URL").unwrap().to_str().unwrap();
    let version = response.version();

    let bytes = to_bytes(response.into_body()).await?;

    match serde_json::from_slice::<ServerResponse>(bytes.as_ref()) {
        Ok(server_response) => {
            if server_response.result != "success" {
                println!("Server returned error {:?}", server_response.result);
            }
            match server_response.arguments {
                Some(Arguments { torrents }) => {
                    process_torrents(app, torrents, original_url, toast).await;
                }
                None => println!("Server returned success but no arguments!"),
            }
        }
        Err(e) => println!("Failed to parse {:?}", e),
    };

    let mut response_builder = Response::builder().status(status).version(version);
    headers.iter().for_each(|(name, value)| {
        response_builder
            .headers_mut()
            .unwrap()
            .insert(name, value.clone());
    });
    let body = Body::from(bytes);
    Ok(response_builder.body(body).unwrap())
}

async fn process_torrents(
    app: &AppHandle,
    mut torrents: Vec<Torrent>,
    original_url: &str,
    toast: bool,
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
                // then show a "download complete" notification
                if toast && new_torrent.status > 4 && old_torrent.status == 4 {
                    play_sound = true;
                    show_notification(app, new_torrent.name.as_str());
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
    // Temporarily use notify_rust directly because default sound on windows is forced
    // see https://github.com/tauri-apps/tauri/issues/7210

    // if let Err(e) = Notification::new(app.config().tauri.bundle.identifier.as_str())
    //     .title("Download complete")
    //     .body(name)
    //     .show()
    // {
    //     println!("Cannot show notification: {:?}", e);
    // }

    let mut notification = notify_rust::Notification::new();
    notification.summary("Download complete");
    notification.body(name);
    notification.auto_icon();

    let config = app.config();
    let identifier = config.tauri.bundle.identifier.as_str();

    #[cfg(windows)]
    {
        let exe = tauri_utils::platform::current_exe().expect("failed to get exe");
        let exe_dir = exe.parent().expect("failed to get exe directory");
        let curr_dir = exe_dir.display().to_string();
        // set the notification's System.AppUserModel.ID only when running the installed app
        if !(curr_dir.ends_with("\\target\\debug")
            || curr_dir.ends_with("\\target\\release"))
        {
            notification.app_id(identifier);
        }
    }
    #[cfg(target_os = "macos")]
    {
        let _ = notify_rust::set_application(if cfg!(feature = "custom-protocol") {
            identifier
        } else {
            "com.apple.Terminal"
        });
    }

    async_runtime::spawn(async move {
        let _ = notification.show();
    });
}
