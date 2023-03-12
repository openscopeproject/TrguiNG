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

use std::net::TcpListener;
use std::sync::Arc;

use hyper::body::Bytes;
use hyper::header::{
    self, HeaderValue, ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS,
    ACCESS_CONTROL_ALLOW_ORIGIN, AUTHORIZATION, ORIGIN,
};
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Client, HeaderMap, Method, Request, Response, Server, StatusCode};
use tauri::{async_runtime, AppHandle, Manager};
use tokio::sync::{oneshot, Semaphore};

const ADDRESS: &str = "127.123.45.67:8080";
const ALLOW_ORIGINS: &'static [&'static str] = if cfg!(feature = "custom-protocol") {
    &["tauri://localhost", "https://tauri.localhost"]
} else {
    &["http://localhost:8080"]
};
const TRANSMISSION_SESSION_ID: &str = "X-Transmission-Session-Id";

pub struct Ipc {
    pub listening: bool,
    listener: Option<TcpListener>,
    stop_signal: Option<oneshot::Sender<()>>,
    start_signal: Arc<Semaphore>,
}

#[derive(Clone, serde::Serialize)]
struct Payload(String);

fn not_found() -> Response<Body> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body("NOT FOUND".into())
        .unwrap()
}

fn invalid_request(request_headers: &HeaderMap, msg: &str) -> Response<Body> {
    let mut response = Response::builder()
        .status(StatusCode::BAD_REQUEST)
        .body(format!("INVALID REQUEST: {}", msg).into())
        .unwrap();
    cors(request_headers, &mut response, ALLOW_ORIGINS);
    response
}

fn cors(request_headers: &HeaderMap, r: &mut Response<Body>, allowed_origins: &[&str]) {
    if let header::Entry::Occupied(e) = r.headers_mut().entry(ACCESS_CONTROL_ALLOW_ORIGIN) {
        e.remove_entry_mult();
    }
    if let Some(origin) = request_headers.get(ORIGIN) {
        if allowed_origins.iter().any(|o| o == origin) {
            r.headers_mut()
                .append(ACCESS_CONTROL_ALLOW_ORIGIN, origin.into());
        }
    }
    r.headers_mut()
        .append(ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("*"));
    r.headers_mut().append(
        ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("POST, OPTIONS"),
    );
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
        (&Method::OPTIONS, "/post") => {
            let mut response = Response::builder()
                .status(200u16)
                .body(Body::empty())
                .unwrap();
            cors(&req.headers(), &mut response, ALLOW_ORIGINS);
            Ok(response)
        }
        (&Method::POST, "/post") => proxy_fetch(req).await,
        _ => Ok(not_found()),
    }
}

async fn proxy_fetch(req: Request<Body>) -> Result<Response<Body>, hyper::Error> {
    if let Some(query) = req.uri().query() {
        if let Some(url) = query
            .split("&")
            .map(|p| {
                let parts: Vec<&str> = p.split("=").collect();
                (parts[0], parts[1])
            })
            .find_map(|p| if p.0 == "url" { Some(p.1) } else { None })
        {
            let url = urlencoding::decode(url).ok().unwrap().into_owned();
            let headers = req.headers().clone();
            let tr_header = headers.get(TRANSMISSION_SESSION_ID);
            let auth_header = headers.get(AUTHORIZATION);
            let mut req_builder = Request::builder()
                .method(Method::POST)
                .uri(url)
                .header("content-type", "application/json");
            if tr_header.is_some() {
                req_builder = req_builder.header(TRANSMISSION_SESSION_ID, tr_header.unwrap());
            }
            if auth_header.is_some() {
                req_builder = req_builder.header(AUTHORIZATION, auth_header.unwrap());
            }

            match req_builder.body(req.into_body()) {
                Ok(req) => {
                    let client = Client::new();

                    match client.request(req).await {
                        Ok(mut response) => {
                            cors(&headers, &mut response, ALLOW_ORIGINS);
                            Ok(response)
                        }
                        Err(e) => Err(e),
                    }
                }
                Err(e) => Ok(invalid_request(&headers, e.to_string().as_str())),
            }
        } else {
            return Ok(invalid_request(req.headers(), "no url query parameter"));
        }
    } else {
        return Ok(invalid_request(req.headers(), "no query parameters"));
    }
}

async fn send_payoad(app: &AppHandle, payload: Bytes) {
    app.get_window("main")
        .unwrap()
        .emit(
            "app-arg",
            Payload(std::str::from_utf8(&payload).unwrap().to_string()),
        )
        .unwrap();
}

impl Ipc {
    pub fn new() -> Self {
        Self {
            listening: false,
            listener: None,
            stop_signal: Default::default(),
            start_signal: Semaphore::new(0).into(),
        }
    }

    pub fn try_bind(&mut self) {
        if let Ok(listener) = TcpListener::bind(ADDRESS) {
            self.listener = Some(listener);
            self.listening = true;
        }
    }

    pub async fn listen(&mut self, app: Arc<AppHandle>) -> Result<(), &str> {
        if !self.listening {
            return Err("No TCP listener");
        }

        let start = self.start_signal.clone();
        let make_service = make_service_fn(move |_| {
            let app = app.clone();
            let start = start.clone();
            let service_fn = service_fn(move |req| http_response(app.clone(), start.clone(), req));
            async move { Ok::<_, hyper::Error>(service_fn) }
        });

        let (tx_stop, rx_stop) = oneshot::channel::<()>();

        if let Ok(server) = Server::from_tcp(self.listener.take().unwrap()) {
            let server = server
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
        } else {
            Err("Unable to create server")
        }
    }

    pub fn start(&self) {
        self.start_signal.add_permits(1);
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_signal.take() {
            tx.send(()).ok();
        }
        self.listener = None;
        self.listening = false;
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
