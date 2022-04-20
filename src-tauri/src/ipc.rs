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

use std::sync::Arc;

use hyper::body::Bytes;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Client, Method, Request, Response, Server, StatusCode};
use tauri::{async_runtime, AppHandle, Manager};
use tokio::sync::{oneshot, Semaphore};

const ADDRESS: &str = "127.123.45.67:8080";
pub struct Ipc {
    stop_signal: Option<oneshot::Sender<()>>,
    start_signal: Arc<Semaphore>,
}

impl Default for Ipc {
    fn default() -> Self {
        Self {
            stop_signal: Default::default(),
            start_signal: Semaphore::new(0).into(),
        }
    }
}

#[derive(Clone, serde::Serialize)]
struct Payload(String);

fn not_found() -> Response<Body> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body("NOT FOUND".into())
        .unwrap()
}

async fn http_response(
    app: Arc<AppHandle>,
    start_signal: Arc<Semaphore>,
    req: Request<Body>,
) -> hyper::Result<Response<Body>> {
    match (req.method(), req.uri().path()) {
        (&Method::POST, "/args") => {
            let payload = hyper::body::to_bytes(req.into_body()).await?;
            {
                let _ = start_signal.acquire().await;
                send_payoad(&app, payload).await;
            }

            Ok(Response::builder()
                .body(Body::from("transgui-ng OK"))
                .unwrap())
        }
        _ => Ok(not_found()),
    }
}

async fn send_payoad(app: &AppHandle, payoad: Bytes) {
    app.get_window("main")
        .unwrap()
        .emit(
            "app-arg",
            Payload(std::str::from_utf8(&payoad).unwrap().to_string()),
        )
        .unwrap();
}

impl Ipc {
    pub async fn listen(&mut self, app: Arc<AppHandle>) -> Result<(), hyper::Error> {
        let addr = ADDRESS.parse().unwrap();

        let start = self.start_signal.clone();
        let make_service = make_service_fn(move |_| {
            let app = app.clone();
            let start = start.clone();
            let service_fn = service_fn(move |req| http_response(app.clone(), start.clone(), req));
            async move { Ok::<_, hyper::Error>(service_fn) }
        });

        let (tx_stop, rx_stop) = oneshot::channel::<()>();

        let server = Server::try_bind(&addr)?
            .serve(make_service)
            .with_graceful_shutdown(async move {
                rx_stop.await.ok();
                println!("Shutdown request received");
            });

        self.stop_signal = Some(tx_stop);

        async_runtime::spawn(async move {
            server.await.unwrap();
        });

        Ok(())
    }

    pub fn start(&self) {
        self.start_signal.add_permits(1);
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_signal.take() {
            tx.send(()).ok();
        }
    }

    pub async fn send(&self, args: &Vec<String>) -> Result<(), hyper::Error> {
        let req = Request::builder()
            .method(Method::POST)
            .uri(format!("http://{}/args", ADDRESS))
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(args).unwrap()))
            .unwrap();

        let client = Client::new();

        async_runtime::spawn(async move {
            if let Ok(resp) = client.request(req).await {
                if let Ok(resp_bytes) = hyper::body::to_bytes(resp.into_body()).await {
                    println!(
                        "Got response: {}",
                        std::str::from_utf8(&resp_bytes.to_vec()).unwrap()
                    );
                }
            }
        });

        Ok(())
    }
}
