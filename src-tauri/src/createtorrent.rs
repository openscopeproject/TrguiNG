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

use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use lava_torrent::{
    bencode::BencodeElem,
    torrent::v1::{Torrent, TorrentBuild, TorrentBuilder},
    LavaTorrentError,
};
use tokio::sync::Mutex;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentCreateInfo {
    name: String,
    path: String,
    piece_length: i64,
    comment: String,
    source: String,
    private: bool,
    announce_list: Vec<String>,
    url_list: Vec<String>,
    version: String,
}

#[derive(serde::Serialize)]
pub struct ProgressData {
    hashed: u64,
    total: u64,
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CreateCheckResult {
    NotFound,
    Error(String),
    Complete(String),
    InProgress(ProgressData),
}

enum BuildOrTorrent {
    Build(TorrentBuild),
    Result(Result<Torrent, LavaTorrentError>),
}

#[derive(Default)]
pub struct CreationRequests {
    requests: HashMap<i32, BuildOrTorrent>,
}

#[derive(Default)]
pub struct CreationRequestsHandle(pub Arc<Mutex<CreationRequests>>);

impl CreationRequests {
    pub fn add(&mut self, id: i32, info: TorrentCreateInfo) -> Result<(), LavaTorrentError> {
        let url_list = info
            .url_list
            .iter()
            .filter(|s| !s.is_empty())
            .map(|url| BencodeElem::String(url.clone()))
            .collect::<Vec<BencodeElem>>();

        let announce_list = info
            .announce_list
            .split(|s| s.is_empty())
            .filter(|tier| !(*tier).is_empty())
            .map(|tier| tier.to_vec())
            .collect::<Vec<Vec<String>>>();

        let mut builder = TorrentBuilder::new(info.path, info.piece_length)
            .set_name(info.name)
            .set_announce(info.announce_list.first().cloned())
            .add_extra_field(
                "created by".into(),
                BencodeElem::String(format!("TrguiNG {}", info.version)),
            )
            .add_extra_field(
                "creation date".into(),
                BencodeElem::Integer(
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .expect("System time is before Unix epoch!")
                        .as_secs()
                        .try_into()
                        .unwrap(),
                ),
            );

        if !url_list.is_empty() {
            builder = builder.add_extra_field("url-list".into(), BencodeElem::List(url_list));
        }
        if !info.announce_list.is_empty() {
            builder = builder.set_announce_list(announce_list);
        }
        if !info.comment.is_empty() {
            builder = builder
                .add_extra_field("comment".into(), BencodeElem::String(info.comment.clone()));
        }
        if !info.source.is_empty() {
            builder = builder
                .add_extra_info_field("source".into(), BencodeElem::String(info.source.clone()));
        }
        if info.private {
            builder = builder.set_privacy(true);
        }

        let build = builder.build_non_blocking()?;
        if let Some(BuildOrTorrent::Build(old_build)) =
            self.requests.insert(id, BuildOrTorrent::Build(build))
        {
            old_build.cancel();
        }

        Ok(())
    }

    pub fn check(&mut self, id: i32) -> CreateCheckResult {
        if let Some(BuildOrTorrent::Build(build)) = self.requests.get(&id) {
            if build.is_finished() {
                let BuildOrTorrent::Build(build) = self.requests.remove(&id).unwrap() else {
                    panic!("The build entry was just here")
                };
                self.requests
                    .insert(id, BuildOrTorrent::Result(build.get_output()));
            }
        }

        match self.requests.get(&id) {
            Some(BuildOrTorrent::Build(build)) => CreateCheckResult::InProgress(ProgressData {
                hashed: build.get_n_piece_processed(),
                total: build.get_n_piece_total(),
            }),
            Some(BuildOrTorrent::Result(Ok(torrent))) => {
                CreateCheckResult::Complete(torrent.info_hash())
            }
            Some(BuildOrTorrent::Result(Err(e))) => CreateCheckResult::Error(e.to_string()),
            None => CreateCheckResult::NotFound,
        }
    }

    pub fn cancel(&mut self, id: i32) -> Result<(), String> {
        if let Some(build_or_torrent) = self.requests.remove(&id) {
            if let BuildOrTorrent::Build(build) = build_or_torrent {
                build.cancel();
            }
            Ok(())
        } else {
            Err("Torrent build request not found".into())
        }
    }

    pub fn save(&mut self, id: i32, path: &String) -> Result<(), String> {
        if let Some(BuildOrTorrent::Result(Ok(torrent))) = self.requests.remove(&id) {
            torrent.write_into_file(path).map_err(|e| e.to_string())
        } else {
            Err("Torrent build request not found".into())
        }
    }
}
