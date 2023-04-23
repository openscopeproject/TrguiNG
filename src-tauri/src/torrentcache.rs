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

use std::{collections::HashMap, sync::Arc};

use hyper::{body::to_bytes, Body, Response};
use serde::Deserialize;
use tauri::{api::notification::Notification, async_runtime::Mutex, AppHandle, Manager, State};

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

pub async fn process_torrents(
    app: &AppHandle,
    response: Response<Body>,
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
                Some(Arguments { mut torrents }) => {
                    let cache_handle: State<TorrentCacheHandle> = app.state();
                    let mut cache = cache_handle.0.lock().await;
                    let mut map = HashMap::<i64, Torrent>::new();
                    torrents.drain(..).for_each(|t| {
                        map.insert(t.id, t);
                    });
                    if let Some(old_map) = cache.server_data.insert(original_url.into(), map) {
                        let new_map = cache.server_data.get(&String::from(original_url)).unwrap();
                        old_map.iter().for_each(|(id, old_torrent)| {
                            if let Some(new_torrent) = new_map.get(id) {
                                if new_torrent.status == 6 && old_torrent.status == 4 {
                                    show_notification(app, &new_torrent.name);
                                }
                            }
                        });
                    }
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

fn show_notification(app: &AppHandle, name: &String) {
    if let Err(e) = Notification::new(app.config().tauri.bundle.identifier.as_str())
        .title("Download complete")
        .body(format!("{} has finished downloading", name))
        .show()
    {
        println!("Cannot show notification: {:?}", e);
    }
}
