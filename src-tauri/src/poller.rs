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

use serde::Deserialize;
use std::{collections::HashMap, sync::Arc, time::Duration};
use tauri::{
    async_runtime::{self, JoinHandle, Mutex},
    http::HeaderValue,
    AppHandle, Manager, State,
};

use crate::torrentcache::process_response;

#[derive(Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct Connection {
    url: String,
    username: String,
    password: String,
    #[serde(default)]
    accept_invalid_certs: bool,
}
#[derive(Deserialize, Debug, Clone, PartialEq)]
pub struct PollerConfig {
    name: String,
    connection: Connection,
    interval: u64,
}

#[derive(Debug)]
struct PollerConfigData {
    config: PollerConfig,
    transmission_session: Option<String>,
    join_handle: JoinHandle<()>,
}

#[derive(Default)]
pub struct Poller {
    configs: HashMap<String, PollerConfigData>,
    toast: bool,
    sound: bool,
    app_handle: Option<AppHandle>,
}

impl Poller {
    pub fn set_app_handle(&mut self, app_handle: &AppHandle) {
        self.app_handle = Some(app_handle.clone());
    }

    pub fn set_configs(&mut self, mut configs: Vec<PollerConfig>, toast: bool, sound: bool) {
        self.toast = toast;
        self.sound = sound;

        let mut old_configs = std::mem::take(&mut self.configs);
        old_configs.drain().for_each(|(_, c)| {
            c.join_handle.abort();
        });

        configs.drain(..).for_each(|c| {
            self.add_config(c);
        });
    }

    fn add_config(&mut self, config: PollerConfig) {
        if let Some(app) = &self.app_handle {
            let join_handle = async_runtime::spawn(polling_task(
                app.clone(),
                config.name.clone(),
                self.toast,
                self.sound,
            ));
            self.configs.insert(
                config.name.clone(),
                PollerConfigData {
                    config,
                    transmission_session: None,
                    join_handle,
                },
            );
        }
    }
}

#[derive(Default)]
pub struct PollerHandle(pub Arc<Mutex<Poller>>);

async fn polling_task(app: AppHandle, name: String, toast: bool, sound: bool) {
    let poller_handle: State<PollerHandle> = app.state();
    let interval;

    {
        let poller = poller_handle.0.lock().await;
        let config = &poller.configs.get(&name).unwrap().config;
        interval = config.interval;
    }

    loop {
        tokio::time::sleep(Duration::from_secs(interval)).await;

        // Acquire lock only to get copies of data needed for polling
        let poller = poller_handle.0.lock().await;
        let data = poller.configs.get(&name).unwrap();
        let connection = data.config.connection.clone();
        let session = data.transmission_session.clone();
        drop(poller);

        let result = poll(&app.clone(), connection.clone(), session, toast, sound).await;
        let mut new_session = None;

        match result {
            Ok(_) => {}
            Err(Some(session)) => {
                // try again with new session token
                if (poll(&app, connection, Some(session.clone()), toast, sound).await).is_ok() {
                    new_session = Some(session);
                }
            }
            Err(None) => {}
        }
        if let Some(session) = new_session {
            // Reaquire lock to write session token
            let mut poller = poller_handle.0.lock().await;
            let data = poller.configs.get_mut(&name).unwrap();
            data.transmission_session = Some(session);
        };
    }
}

const TRANSMISSION_SESSION: &str = "X-Transmission-Session-Id";
const TORRENT_GET_BODY: &str = r#"
{
    "method": "torrent-get",
    "arguments": {
        "fields": ["id","name","status"]
    }
}"#;

async fn poll(
    app: &AppHandle,
    connection: Connection,
    session: Option<String>,
    toast: bool,
    sound: bool,
) -> Result<String, Option<String>> {
    let clients = app.state::<crate::HttpClients>();
    let client = if connection.accept_invalid_certs { &clients.insecure } else { &clients.default };

    let mut req = client
        .post(connection.url.clone())
        .header(reqwest::header::CONTENT_TYPE, "application/json");
    if let Some(session) = session {
        req = req.header(
            TRANSMISSION_SESSION,
            HeaderValue::from_str(session.as_str()).unwrap(),
        );
    }
    if !connection.username.is_empty() || !connection.password.is_empty() {
        req = req.basic_auth(connection.username, Some(connection.password));
    }

    match req.body(reqwest::Body::from(TORRENT_GET_BODY)).send().await {
        Ok(response) => {
            let session = response
                .headers()
                .get(TRANSMISSION_SESSION)
                .map(|v| v.to_owned());
            if response.status().is_success() || response.status().as_u16() == 409 {
                let session_str = session.map_or(String::default(), |f| {
                    f.to_str().unwrap_or_default().to_string()
                });
                if response.status().is_success() {
                    let response_bytes = response
                        .bytes()
                        .await
                        .map_err(|_| "Failed to read response".to_string())?;
                    let _ = process_response(
                        app,
                        &response_bytes,
                        connection.url.as_str(),
                        toast,
                        sound,
                    )
                    .await;
                    Ok(session_str)
                } else {
                    Err(Some(session_str))
                }
            } else {
                println!(
                    "Unexpected status code during polling: {:?}",
                    response.status()
                );
                Err(None)
            }
        }
        Err(e) => {
            println!("Error during polling: {e:?}");
            Err(None)
        }
    }
}
