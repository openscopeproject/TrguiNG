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

// Based on https://github.com/FabianLars/tauri-plugin-deep-link

use std::{
    io::{ErrorKind, Result},
    sync::Mutex,
};

use objc2::{
    class, declare_class,
    ffi::NSInteger,
    msg_send, msg_send_id, mutability,
    rc::Id,
    runtime::{AnyObject, NSObject},
    sel, ClassType, DeclaredClass,
};
use once_cell::sync::OnceCell;
use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};

type THandler = OnceCell<Mutex<Box<dyn FnMut(Vec<String>) + Send + 'static>>>;

// If the Mutex turns out to be a problem, or FnMut turns out to be useless, we can remove the Mutex and turn FnMut into Fn
static HANDLER: THandler = OnceCell::new();

// keyDirectObject
const KEY_DIRECT_OBJECT: u32 = 0x2d2d2d2d;

// kInternetEventClass
const GURL_EVENT_CLASS: u32 = 0x4755524c;
// kAEGetURL
const EVENT_GET_URL: u32 = 0x4755524c;

// kCoreEventClass
const CORE_EVENT_CLASS: u32 = 0x61657674;
// kAEOpenDocuments
const EVENT_OPEN_DOCUMENTS: u32 = 0x6F646F63;
// kAEReopenApplication
const EVENT_REOPEN_APP: u32 = 0x72617070;

// Adapted from https://github.com/mrmekon/fruitbasket/blob/aad14e400d710d1d46317c0d8c55ff742bfeaadd/src/osx.rs#L848
fn parse_event(event: *mut AnyObject) -> Vec<String> {
    if event as u64 == 0u64 {
        return vec![];
    }
    unsafe {
        let class: u32 = msg_send![event, eventClass];
        let id: u32 = msg_send![event, eventID];

        match (class, id) {
            (GURL_EVENT_CLASS, EVENT_GET_URL) => {
                let url: *mut AnyObject =
                    msg_send![event, paramDescriptorForKeyword: KEY_DIRECT_OBJECT];
                let nsstring: *mut AnyObject = msg_send![url, stringValue];
                let cstr: *const i8 = msg_send![nsstring, UTF8String];

                if !cstr.is_null() {
                    vec![std::ffi::CStr::from_ptr(cstr).to_string_lossy().to_string()]
                } else {
                    vec![]
                }
            }
            (CORE_EVENT_CLASS, EVENT_OPEN_DOCUMENTS) => {
                let documents: *mut AnyObject =
                    msg_send![event, paramDescriptorForKeyword: KEY_DIRECT_OBJECT];
                let count: NSInteger = msg_send![documents, numberOfItems];

                let mut paths = Vec::<String>::new();

                for i in 1..count + 1 {
                    let path: *mut AnyObject = msg_send![documents, descriptorAtIndex: i];
                    let nsstring: *mut AnyObject = msg_send![path, stringValue];
                    let cstr: *const i8 = msg_send![nsstring, UTF8String];

                    if !cstr.is_null() {
                        let path_str = std::ffi::CStr::from_ptr(cstr).to_string_lossy().to_string();
                        paths.push(path_str);
                    }
                }

                paths
            }
            // reopen app event has no useful payload
            (_, _) => {
                vec![]
            }
        }
    }
}

declare_class!(
    struct Handler;

    unsafe impl ClassType for Handler {
        type Super = NSObject;
        type Mutability = mutability::Immutable;
        const NAME: &'static str = "TauriPluginDeepLinkHandler";
    }

    impl DeclaredClass for Handler {}

    unsafe impl Handler {
        #[method(handleEvent:withReplyEvent:)]
        fn handle_event(&self, event: *mut AnyObject, _replace: *const AnyObject) {
            let s = parse_event(event);
            let mut cb = HANDLER.get().unwrap().lock().unwrap();
            cb(s);
        }
    }
);

impl Handler {
    pub fn new() -> Id<Self> {
        let cls = Self::class();
        unsafe { msg_send_id![msg_send_id![cls, alloc], init] }
    }
}

// Call this once early in app main() or setup hook
pub fn set_handler<F: FnMut(Vec<String>) + Send + 'static>(handler: F) -> Result<()> {
    if HANDLER.set(Mutex::new(Box::new(handler))).is_err() {
        return Err(std::io::Error::new(
            ErrorKind::AlreadyExists,
            "Handler was already set",
        ));
    }

    Ok(())
}

fn listen_apple_event(event_class: u32, event_id: u32) {
    unsafe {
        let event_manager: Id<AnyObject> =
            msg_send_id![class!(NSAppleEventManager), sharedAppleEventManager];

        let handler = Handler::new();
        let handler_boxed = Box::into_raw(Box::new(handler));

        let _: () = msg_send![&event_manager,
            setEventHandler: &**handler_boxed
            andSelector: sel!(handleEvent:withReplyEvent:)
            forEventClass:event_class
            andEventID:event_id];
    }
}

// Call this in app setup hook
pub fn listen_url() {
    listen_apple_event(GURL_EVENT_CLASS, EVENT_GET_URL);
}

// Call this after app is initialised
pub fn listen_open_documents() {
    listen_apple_event(CORE_EVENT_CLASS, EVENT_OPEN_DOCUMENTS);
}

// Call this after app is initialised
pub fn listen_reopen_app() {
    listen_apple_event(CORE_EVENT_CLASS, EVENT_REOPEN_APP);
}

pub fn make_menu(app_name: &str) -> Menu {
    let mut menu = Menu::new();

    menu = menu.add_submenu(Submenu::new(
        app_name,
        Menu::new()
            .add_native_item(MenuItem::CloseWindow)
            .add_item(CustomMenuItem::new("quit", "Quit").accelerator("Cmd+q")),
    ));

    let mut edit_menu = Menu::new();
    edit_menu = edit_menu.add_native_item(MenuItem::Cut);
    edit_menu = edit_menu.add_native_item(MenuItem::Copy);
    edit_menu = edit_menu.add_native_item(MenuItem::Paste);
    menu = menu.add_submenu(Submenu::new("Edit", edit_menu));

    menu = menu.add_submenu(Submenu::new(
        "View",
        Menu::new().add_native_item(MenuItem::EnterFullScreen),
    ));

    let mut window_menu = Menu::new();
    window_menu = window_menu.add_native_item(MenuItem::Minimize);
    window_menu = window_menu.add_native_item(MenuItem::Zoom);
    window_menu = window_menu.add_native_item(MenuItem::Separator);
    window_menu = window_menu.add_native_item(MenuItem::CloseWindow);
    menu = menu.add_submenu(Submenu::new("Window", window_menu));

    menu
}
