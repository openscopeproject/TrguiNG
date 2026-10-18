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

use std::str::FromStr;
use std::sync::{OnceLock, RwLock};

use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};

// Keep each language's code, embedded resource and cache in one declaration.
macro_rules! define_languages {
    ($($(#[$attribute:meta])* $variant:ident => $code:literal),+ $(,)?) => {
        #[derive(Clone, Copy, Default)]
        pub enum SupportedLanguage {
            $($(#[$attribute])* $variant,)+
        }

        impl SupportedLanguage {
            const ALL: &[Self] = &[$(Self::$variant,)+];

            fn code(self) -> &'static str {
                match self {
                    $(Self::$variant => $code,)+
                }
            }

            fn resources(self) -> &'static Value {
                match self {
                    $(Self::$variant => {
                        static RESOURCES: OnceLock<Value> = OnceLock::new();
                        RESOURCES.get_or_init(|| {
                            serde_json::from_str(include_str!(concat!(
                                "../../src/i18n/locales/", $code, ".json"
                            )))
                            .expect(concat!("Invalid locale: ", $code))
                        })
                    },)+
                }
            }
        }
    };
}

define_languages! {
    #[default] English => "en",
    SimplifiedChinese => "zh-CN",
    Russian => "ru",
}

impl FromStr for SupportedLanguage {
    type Err = ();

    fn from_str(language: &str) -> Result<Self, Self::Err> {
        Self::ALL
            .iter()
            .copied()
            .find(|candidate| candidate.code().eq_ignore_ascii_case(language))
            .or_else(|| {
                let base = language.split('-').next().unwrap_or(language);
                Self::ALL.iter().copied().find(|candidate| {
                    candidate
                        .code()
                        .split('-')
                        .next()
                        .unwrap()
                        .eq_ignore_ascii_case(base)
                })
            })
            .ok_or(())
    }
}

pub struct Language(pub RwLock<SupportedLanguage>);

impl Default for Language {
    fn default() -> Self {
        Self(RwLock::new(SupportedLanguage::default()))
    }
}

pub fn translate(language: SupportedLanguage, key: &str) -> String {
    let lookup = |resources: &'static Value| {
        key.split('.')
            .try_fold(resources, |value, part| value.get(part))
            .and_then(Value::as_str)
    };
    lookup(language.resources())
        .or_else(|| lookup(SupportedLanguage::default().resources()))
        .unwrap_or(key)
        .to_string()
}

pub fn text<R: Runtime>(app: &AppHandle<R>, key: &str) -> String {
    let state = app.state::<Language>();
    let language = *state.0.read().unwrap();
    translate(language, key)
}
