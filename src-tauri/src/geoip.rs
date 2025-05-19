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

use std::{net::IpAddr, sync::Arc};

use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct MmdbReaderHandle(pub Arc<Mutex<Option<maxminddb::Reader<Vec<u8>>>>>);

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LookupResult {
    ip: IpAddr,
    #[serde(skip_serializing_if = "Option::is_none")]
    iso_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
}

pub async fn lookup(app: &AppHandle, ips: Vec<IpAddr>) -> Vec<LookupResult> {
    let reader_handle: State<MmdbReaderHandle> = app.state();
    let mut reader = reader_handle.0.lock().await;
    if reader.is_none() {
        let dbip_path = app
            .path()
            .resolve("dbip.mmdb", tauri::path::BaseDirectory::Resource)
            .expect("failed to resolve resource");

        if dbip_path.is_file() {
            match maxminddb::Reader::open_readfile(&dbip_path) {
                Ok(db) => *reader = Some(db),
                Err(_) => {
                    println!("{} is invalid", dbip_path.as_path().display());
                    return vec![];
                }
            }
        } else {
            println!("{} does not exist", dbip_path.as_path().display());
            return vec![];
        }
    }

    let reader = reader.as_ref().unwrap();

    let response: Vec<_> = ips
        .into_iter()
        .map(|ip| {
            match reader
                .lookup::<maxminddb::geoip2::Country>(ip)
                .ok()
                .flatten()
                .and_then(|c| c.country)
            {
                Some(country) => LookupResult {
                    ip,
                    iso_code: country.iso_code.map(|c| c.to_string()),
                    name: country
                        .names
                        .and_then(|names| names.get("en").map(|s| s.to_string())),
                },
                None => LookupResult {
                    ip,
                    iso_code: None,
                    name: None,
                },
            }
        })
        .collect();

    response
}
