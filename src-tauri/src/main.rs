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

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Arc;

use tauri::{
    api::cli::get_matches,
    async_runtime::{self, Mutex},
    AppHandle, Manager, State,
};

mod ipc;
mod commands;

struct ListenerHandle(Arc<Mutex<ipc::Ipc>>);

fn main() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::read_file])
        .manage(ListenerHandle(Default::default()))
        .setup(|app| {
            let args = get_matches(app.config().tauri.cli.as_ref().unwrap(), app.package_info())
                .unwrap()
                .args;

            if args.contains_key("help") {
                println!("{}", args["help"].value.as_str().unwrap());
                app.get_window("main").unwrap().close().ok();
                return Ok(());
            }

            let mut torrents: Vec<String> = vec![];
            if args["torrent"].value.is_array() {
                torrents = args["torrent"]
                    .value
                    .as_array()
                    .unwrap()
                    .into_iter()
                    .map(|v| v.as_str().unwrap().to_string())
                    .collect();
            }

            let listener_state: State<ListenerHandle> = app.state();
            let listener_mutex = listener_state.0.clone();
            let app: Arc<AppHandle> = app.handle().into();
            async_runtime::spawn(async move {
                let mut listening = true;
                {
                    let mut listener = listener_mutex.lock().await;
                    if let Err(_) = listener.listen(app.clone()).await {
                        listener.start();
                        listener.stop();
                        listening = false;
                    }
                    if let Err(e) = listener.send(&torrents).await {
                        println!("Unable to send args to listener: {:?}", e);
                    }
                }
                let main_window = app.get_window("main").unwrap();

                if listening {
                    let _ = app.listen_global("listener-start", move |_| {
                        let listener_mutex = listener_mutex.clone();
                        async_runtime::spawn(async move {
                            let listener = listener_mutex.lock().await;
                            listener.start();
                        });
                    });
                    main_window.show().ok();
                } else {
                    main_window.close().ok();
                }
            });

            Ok(())
        })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::Destroyed => {
                if event.window().label() == "main" {
                    let app = event.window().app_handle();
                    let listener_state: State<ListenerHandle> = app.state();
                    async_runtime::block_on(async move {
                        let mut listener = listener_state.0.lock().await;
                        listener.stop();
                    });
                }
            }
            _ => {}
        })
        .run(context)
        .expect("error while running tauri application");
}
