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

use std::sync::{OnceLock, RwLock};

use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};

pub struct Language(pub RwLock<&'static str>);

impl Default for Language {
    fn default() -> Self {
        Self(RwLock::new("en"))
    }
}

pub fn resolve(language: &str) -> &'static str {
    if language.to_ascii_lowercase().starts_with("zh") {
        "zh-CN"
    } else {
        "en"
    }
}

pub fn translate(language: &str, key: &str) -> String {
    static ENGLISH: OnceLock<Value> = OnceLock::new();
    static CHINESE: OnceLock<Value> = OnceLock::new();
    let english = ENGLISH.get_or_init(|| {
        serde_json::from_str(include_str!("../../src/locales/en.json"))
            .expect("Invalid English locale")
    });
    let resources = if resolve(language) == "zh-CN" {
        CHINESE.get_or_init(|| {
            serde_json::from_str(include_str!("../../src/locales/zh-CN.json"))
                .expect("Invalid Chinese locale")
        })
    } else {
        english
    };
    let lookup = |resources: &'static Value| {
        key.split('.')
            .try_fold(resources, |value, part| value.get(part))
            .and_then(Value::as_str)
    };
    lookup(resources)
        .or_else(|| lookup(english))
        .unwrap_or(key)
        .to_string()
}

pub fn text<R: Runtime>(app: &AppHandle<R>, key: &str) -> String {
    let state = app.state::<Language>();
    let language = *state.0.read().unwrap();
    translate(language, key)
}
