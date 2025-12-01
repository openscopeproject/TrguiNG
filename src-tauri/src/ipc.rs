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

use std::error::Error;
use std::io;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

use http_body_util::combinators::BoxBody;
use http_body_util::{BodyExt, Empty, Full};
use hyper::body::{Bytes, Incoming};
use hyper::header::{
    self, HeaderName, HeaderValue, ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS,
    ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_EXPOSE_HEADERS, AUTHORIZATION, ORIGIN,
};
use hyper::service::service_fn;
use hyper::{HeaderMap, Method, Request, Response, StatusCode};
use tauri::{async_runtime, AppHandle, Emitter, Manager};
use tokio::net::TcpListener;
use tokio::sync::oneshot::Receiver;
use tokio::sync::{oneshot, OwnedSemaphorePermit, Semaphore};

use crate::torrentcache::process_response;
use crate::tray::toggle_main_window;

const ADDRESS: &str = "127.0.0.1:44321";
const ALLOW_ORIGINS: &[&str] = if cfg!(feature = "custom-protocol") {
    &["tauri://localhost", "http://tauri.localhost"]
} else {
    &["http://localhost:8080"]
};
const TRANSMISSION_SESSION_ID: &str = "X-Transmission-Session-Id";

#[derive(Clone, serde::Serialize)]
struct Payload(String);

fn not_found() -> Response<BoxBody<Bytes, hyper::Error>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(make_body("NOT FOUND"))
        .unwrap()
}

fn timed_out(request_headers: &HeaderMap) -> Response<BoxBody<Bytes, hyper::Error>> {
    let mut response = Response::builder()
        .status(StatusCode::REQUEST_TIMEOUT)
        .body(make_body("Request timed out"))
        .unwrap();
    cors(request_headers, &mut response, ALLOW_ORIGINS);
    response
}

fn fetch_error(request_headers: &HeaderMap) -> Response<BoxBody<Bytes, hyper::Error>> {
    let mut response = Response::builder()
        .status(StatusCode::SERVICE_UNAVAILABLE)
        .body(make_body("Proxy fetch error"))
        .unwrap();
    cors(request_headers, &mut response, ALLOW_ORIGINS);
    response
}

fn invalid_request(
    request_headers: &HeaderMap,
    msg: &str,
) -> Response<BoxBody<Bytes, hyper::Error>> {
    let mut response = Response::builder()
        .status(StatusCode::BAD_REQUEST)
        .body(make_body(format!("INVALID REQUEST: {msg}")))
        .unwrap();
    cors(request_headers, &mut response, ALLOW_ORIGINS);
    response
}

fn cors<T>(request_headers: &HeaderMap, r: &mut Response<T>, allowed_origins: &[&str]) {
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
    if !r.headers().contains_key(ACCESS_CONTROL_EXPOSE_HEADERS) {
        r.headers_mut().append(
            ACCESS_CONTROL_EXPOSE_HEADERS,
            HeaderValue::from_static("X-Transmission-Session-Id"),
        );
    }
    r.headers_mut().append(
        ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("POST, OPTIONS"),
    );
}

fn make_body<T: Into<Bytes>>(chunk: T) -> BoxBody<Bytes, hyper::Error> {
    Full::new(chunk.into())
        .map_err(|never| match never {})
        .boxed()
}

async fn http_response(
    app: AppHandle,
    args_lock: Arc<Semaphore>,
    req: Request<Incoming>,
) -> hyper::Result<Response<BoxBody<Bytes, hyper::Error>>> {
    let content_type = req
        .headers()
        .get("Content-Type")
        .and_then(|ct| ct.to_str().ok())
        .unwrap_or("");
    if content_type != "application/json" && req.method() != Method::OPTIONS {
        return Ok(invalid_request(req.headers(), "unexpected content-type"));
    }

    match (req.method(), req.uri().path()) {
        (&Method::POST, "/args") => {
            let payload = req.collect().await?.to_bytes();

            if app.get_webview_window("main").is_none() {
                toggle_main_window(&app, None);
            }

            let lock = args_lock.acquire().await.unwrap();
            send_payload(&app, payload).await;
            drop(lock);

            Ok(Response::builder().body(make_body("TrguiNG OK")).unwrap())
        }
        (&Method::OPTIONS, _) => {
            let mut response = Response::builder()
                .status(200u16)
                .body(Empty::<Bytes>::new().map_err(|n| match n {}).boxed())
                .unwrap();
            cors(req.headers(), &mut response, ALLOW_ORIGINS);
            Ok(response)
        }
        (&Method::POST, "/post") => proxy_fetch(&app, req, false).await,
        (&Method::POST, "/torrentget") => proxy_fetch(&app, req, true).await,
        (&Method::POST, "/iplookup") => geoip_lookup(&app, req).await,
        _ => Ok(not_found()),
    }
}

async fn geoip_lookup(
    app: &AppHandle,
    req: Request<Incoming>,
) -> hyper::Result<Response<BoxBody<Bytes, hyper::Error>>> {
    let headers = req.headers().clone();
    let request_body = req.collect().await?.to_bytes();
    let request_bytes = request_body.as_ref();

    match serde_json::from_slice::<Vec<String>>(request_bytes) {
        Ok(ipstr) => {
            let ips: Vec<_> = ipstr.iter().map(|ip| ip.parse::<IpAddr>()).collect();
            let error_ips: Vec<_> = ips
                .iter()
                .enumerate()
                .filter(|(_, ip)| ip.is_err())
                .map(|(i, r)| (i, r.clone().err().unwrap()))
                .collect();
            if !error_ips.is_empty() {
                let msgs: Vec<_> = error_ips
                    .into_iter()
                    .map(|(i, e)| format!("{}: {}", ipstr[i], e))
                    .collect();
                let msg = format!("{}\n", msgs.join("\n"));
                return Ok(invalid_request(&headers, msg.as_str()));
            }

            let good_ips = ips.into_iter().map(|r| r.unwrap()).collect();

            let lookup_response = serde_json::to_string(&crate::geoip::lookup(app, good_ips).await);

            let mut response = Response::builder()
                .status(StatusCode::OK)
                .body(make_body(
                    lookup_response.unwrap_or("Error serializing response".to_string()),
                ))
                .unwrap();
            cors(&headers, &mut response, ALLOW_ORIGINS);
            Ok(response)
        }
        Err(e) => Ok(invalid_request(
            &headers,
            format!("Can not parse json: {e}\n").as_str(),
        )),
    }
}

async fn proxy_fetch(
    app: &AppHandle,
    req: Request<Incoming>,
    process: bool,
) -> hyper::Result<Response<BoxBody<Bytes, hyper::Error>>> {
    let req_headers = req.headers().clone();
    let toast = req_headers.get("X-TrguiNG-Toast").is_some();
    let sound = req_headers.get("X-TrguiNG-Sound").is_some();

    if let Some(query) = req.uri().query() {
        if let Some(url) = query
            .split('&')
            .map(|p| {
                let parts: Vec<&str> = p.split('=').collect();
                (parts[0], parts[1])
            })
            .find_map(|p| if p.0 == "url" { Some(p.1) } else { None })
        {
            let client = app.state::<reqwest::Client>();

            let url = urlencoding::decode(url).ok().unwrap().into_owned();
            let headers = req.headers().clone();
            let mut req_builder = client
                .post(url.clone())
                .header(reqwest::header::CONTENT_TYPE, "application/json");

            if let Some(tr_header) = headers.get(TRANSMISSION_SESSION_ID) {
                req_builder =
                    req_builder.header(TRANSMISSION_SESSION_ID, tr_header.to_str().unwrap());
            }
            if let Some(auth_header) = headers.get(AUTHORIZATION) {
                req_builder = req_builder.header(
                    reqwest::header::AUTHORIZATION,
                    auth_header.to_str().unwrap(),
                );
            }

            let req_body = req.collect().await?.to_bytes();

            match req_builder.body(reqwest::Body::from(req_body)).send().await {
                Ok(response) => {
                    let is_ok = response.status().is_success();
                    let hyper_response = convert_response(&response);

                    let response_bytes = response.bytes().await;
                    if response_bytes.is_err() {
                        return Ok(fetch_error(&req_headers));
                    }
                    let response_bytes = response_bytes.unwrap();

                    if is_ok && process {
                        let _ = process_response(app, &response_bytes, url.as_str(), toast, sound)
                            .await;
                    }
                    let mut hyper_response =
                        hyper_response.body(make_body(response_bytes)).unwrap();
                    cors(&headers, &mut hyper_response, ALLOW_ORIGINS);
                    Ok(hyper_response)
                }
                Err(e) => {
                    if e.is_timeout()
                        || e.source().is_some_and(|s| {
                            s.downcast_ref::<io::Error>()
                                .is_some_and(|s| s.kind() == io::ErrorKind::TimedOut)
                        })
                    {
                        Ok(timed_out(&headers))
                    } else {
                        Ok(Response::builder()
                            .status(e.status().unwrap_or(StatusCode::SERVICE_UNAVAILABLE))
                            .body(make_body(e.to_string()))
                            .unwrap())
                    }
                }
            }
        } else {
            Ok(invalid_request(req.headers(), "no url query parameter"))
        }
    } else {
        Ok(invalid_request(req.headers(), "no query parameters"))
    }
}

fn convert_response(response: &reqwest::Response) -> tauri::http::response::Builder {
    let mut hyper_response = hyper::Response::builder()
        .status(response.status().as_u16())
        .version(response.version());
    if let Some(headers) = hyper_response.headers_mut() {
        response.headers().iter().for_each(|(name, value)| {
            headers.insert(
                HeaderName::from_bytes(name.as_str().as_bytes()).unwrap(),
                HeaderValue::from_str(
                    value
                        .to_str()
                        .expect("Received non ascii chars in http header"),
                )
                .unwrap(),
            );
        });
    }
    hyper_response
}

async fn send_payload(app: &AppHandle, payload: Bytes) {
    app.get_webview_window("main")
        .unwrap()
        .emit(
            "app-arg",
            Payload(std::str::from_utf8(&payload).unwrap().to_string()),
        )
        .unwrap();
}

async fn http_server(
    app: AppHandle,
    args_sem: Arc<Semaphore>,
    rx_stop: Receiver<()>,
    listener: TcpListener,
) {
    let server = hyper_util::server::conn::auto::Builder::new(hyper_util::rt::TokioExecutor::new());
    let graceful = hyper_util::server::graceful::GracefulShutdown::new();
    let func = move |req| http_response(app.clone(), args_sem.clone(), req);
    tokio::pin!(rx_stop);

    loop {
        tokio::select! {
            conn = listener.accept() => {
                let (stream, _) = match conn {
                    Ok(conn) => conn,
                    Err(e) => {
                        eprintln!("tcp accept error: {e}");
                        continue;
                    }
                };

                let io = hyper_util::rt::TokioIo::new(Box::pin(stream));
                let service = service_fn(func.clone());
                let conn = graceful.watch(server.serve_connection(io, service).into_owned());

                tokio::spawn(async move {
                    if let Err(err) = conn.await {
                        eprintln!("connection error: {err}");
                    }
                });
            },

            _ = &mut rx_stop => {
                drop(listener);
                break;
            }
        }
    }

    tokio::select! {
        biased;
        _ = graceful.shutdown() => {
            eprintln!("Gracefully shutdown!");
        },
        _ = tokio::time::sleep(Duration::from_secs(10)) => {
            eprintln!("Waited 10 seconds for graceful shutdown, aborting...");
        }
    }
}

pub struct Ipc {
    pub listening: bool,
    listener: Option<TcpListener>,
    stop_signal: Option<oneshot::Sender<()>>,
    args_sem: Arc<Semaphore>,
    args_lock: Option<OwnedSemaphorePermit>,
}

impl Ipc {
    pub fn new() -> Self {
        Self {
            listening: false,
            listener: None,
            stop_signal: Default::default(),
            args_sem: Semaphore::new(1).into(),
            args_lock: None,
        }
    }

    pub async fn init(&mut self) {
        self.args_lock = self.args_sem.clone().acquire_owned().await.ok();

        if let Ok(listener) = TcpListener::bind(ADDRESS).await {
            self.listener = Some(listener);
            self.listening = true;
        }
    }

    pub async fn listen(&mut self, app: &AppHandle) -> Result<(), &str> {
        if !self.listening {
            return Err("No TCP listener");
        }

        let args_sem = self.args_sem.clone();
        let app = app.clone();

        let (tx_stop, rx_stop) = oneshot::channel::<()>();
        let tcp_listener = self.listener.take().unwrap();
        self.stop_signal = Some(tx_stop);

        async_runtime::spawn(async move {
            http_server(app, args_sem, rx_stop, tcp_listener).await;
        });

        Ok(())
    }

    pub fn start(&mut self) {
        drop(self.args_lock.take());
    }

    pub async fn pause(&mut self) {
        if self.args_lock.is_none() {
            self.args_lock = self.args_sem.clone().acquire_owned().await.ok();
        }
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_signal.take() {
            tx.send(()).ok();
        }
        self.listener = None;
        self.listening = false;
    }

    pub async fn send(&self, args: &Vec<String>, app: AppHandle) -> Result<(), String> {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .read_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(10))
            .no_proxy()
            .build()
            .expect("Failed to initialize http client");

        let req = client
            .post(format!("http://{ADDRESS}/args"))
            .header(tauri::http::header::CONTENT_TYPE, "application/json")
            .body(reqwest::Body::from(serde_json::to_vec(args).unwrap()));

        let should_stop = !self.listening;

        async_runtime::spawn(async move {
            if let Ok(resp) = req.send().await {
                if let Ok(resp_bytes) = resp.bytes().await {
                    println!(
                        "Got response: {}",
                        std::str::from_utf8(&resp_bytes).unwrap()
                    );
                }
            }

            if should_stop {
                let _ = app.clone().run_on_main_thread(move || {
                    app.cleanup_before_exit();
                    std::process::exit(0);
                });
            }
        });

        Ok(())
    }
}
