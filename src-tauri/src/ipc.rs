use std::sync::Arc;

use hyper::body::Bytes;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Client, Method, Request, Response, Server, StatusCode};
use tauri::{async_runtime, AppHandle, Manager};
use tokio::sync::oneshot;

const ADDRESS: &str = "127.123.45.67:8080";
#[derive(Default)]
pub struct Ipc {
    handle: Option<oneshot::Sender<()>>,
}

#[derive(Clone, serde::Serialize)]
struct Payload(String);

fn not_found() -> Response<Body> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body("NOT FOUND".into())
        .unwrap()
}

async fn http_response(app: Arc<AppHandle>, req: Request<Body>) -> hyper::Result<Response<Body>> {
    match (req.method(), req.uri().path()) {
        (&Method::POST, "/args") => {
            let payload = hyper::body::to_bytes(req.into_body()).await?;
            send_payoad(&app, payload).await;

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
        println!("Starting http server");
        let addr = ADDRESS.parse().unwrap();
        let make_service = make_service_fn(move |_| {
            let app = app.clone();
            let service_fn = service_fn(move |req| http_response(app.clone(), req));
            async move { Ok::<_, hyper::Error>(service_fn) }
        });

        let (tx, rx) = oneshot::channel::<()>();
        let server = Server::try_bind(&addr)?
            .serve(make_service)
            .with_graceful_shutdown(async move {
                rx.await.ok();
                println!("Shutdown request received");
            });

        self.handle = Some(tx);

        async_runtime::spawn(async move { server.await.unwrap(); });

        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.handle.take() {
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
        let resp = client.request(req).await?;
        let resp_bytes = hyper::body::to_bytes(resp.into_body()).await?;
        println!(
            "Got response: {}",
            std::str::from_utf8(&resp_bytes.to_vec()).unwrap()
        );

        Ok(())
    }
}
