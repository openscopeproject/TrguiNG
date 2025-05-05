/**
 * TrguiNG - next gen remote GUI for transmission torrent daemon
 * Copyright (C) 2023  qu1ck (mail at qu1ck.org)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { OpenDialogOptions, SaveDialogOptions } from "@tauri-apps/plugin-dialog";
import type { EventCallback } from "@tauri-apps/api/event";
import type { CloseRequestedEvent, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";

export const TAURI = Object.prototype.hasOwnProperty.call(window, "__TAURI__");
const realAppWindow = TAURI ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api/window")).getCurrentWindow() : undefined;
const WebviewWindow = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api/webviewWindow")).WebviewWindow
    : undefined;
const fs = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/plugin-fs"))
    : undefined;
const clipboard = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/plugin-clipboard-manager"))
    : undefined;

export const appWindow = {
    emit: async (event: string, payload?: unknown) => await realAppWindow?.emit(event, payload),
    listen: async <T>(event: string, handler: EventCallback<T>) =>
        await realAppWindow?.listen(event, handler) ?? (() => { }),
    once: async <T>(event: string, handler: EventCallback<T>) => await realAppWindow?.once(event, handler),

    onCloseRequested: async (handler: (event: CloseRequestedEvent) => void | Promise<void>) =>
        await realAppWindow?.onCloseRequested(handler),
    onFocusChanged: async (handler: EventCallback<boolean>) =>
        await realAppWindow?.onFocusChanged(handler),
    onResized: async (handler: EventCallback<PhysicalSize>) =>
        await realAppWindow?.onResized(handler),
    onMoved: async (handler: EventCallback<PhysicalPosition>) =>
        await realAppWindow?.onMoved(handler),

    setSize: async (size: [number, number]) => {
        if (realAppWindow !== undefined) {
            const PhysicalSize = (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api/window")).PhysicalSize;
            await realAppWindow.setSize(new PhysicalSize(...size));
        }
    },
    setPosition: async (position: [number, number]) => {
        if (realAppWindow !== undefined) {
            const PhysicalPosition = (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api/window")).PhysicalPosition;
            await realAppWindow.setPosition(new PhysicalPosition(...position));
        }
    },

    isMinimized: async () => await realAppWindow?.isMinimized() ?? false,
    hide: async () => await realAppWindow?.hide(),
    show: async () => await realAppWindow?.show(),
    center: async () => await realAppWindow?.center(),
    unminimize: async () => await realAppWindow?.unminimize(),
    setFocus: async () => await realAppWindow?.setFocus(),
    setTitle: async (title: string) => await realAppWindow?.setTitle(title),
};

export const invoke = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api/core")).invoke
    : async <T>(c: string, a: unknown) =>
        await Promise.reject<T>(new Error("Running outside of tauri app"));

export const dialogOpen = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/plugin-dialog")).open
    : async (options?: OpenDialogOptions) =>
        await Promise.reject<string[] | string | null>(new Error("Running outside of tauri app"));

export const dialogSave = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/plugin-dialog")).save
    : async (options?: SaveDialogOptions) =>
        await Promise.reject<string | null>(new Error("Running outside of tauri app"));

export async function makeCreateTorrentView() {
    if (WebviewWindow !== undefined) {
        const webview = new WebviewWindow(`createtorrent-${Math.floor(Math.random() * 2 ** 30)}`, {
            url: "createtorrent.html",
            width: 550,
            height: 700,
            visible: true,
            center: true,
            maximizable: false,
            title: "Create torrent",
        });
        await webview.once("tauri://error", (e) => {
            console.log("Webview error", e);
        });
    }
}

const configFile = "trguing.json";

export async function readConfigText() {
    if (fs !== undefined) {
        return await fs.readTextFile(configFile, { baseDir: fs.BaseDirectory.Config });
    } else {
        return localStorage.getItem("trguing-config") ?? "{}";
    }
}

export async function writeConfigText(contents: string) {
    if (fs !== undefined) {
        await fs.writeTextFile(configFile, contents, { baseDir: fs.BaseDirectory.Config });
    } else {
        localStorage.setItem("trguing-config", contents);
    }
}

export function copyToClipboard(text: string) {
    if (TAURI) void clipboard?.writeText(text);
    else {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand("copy");
        } catch (err) {
            console.error("Can not copy to clipboard.", err);
        }

        document.body.removeChild(textArea);
    }
}

export async function saveJsonFile(contents: string, filename: string) {
    if (fs !== undefined) {
        dialogSave({
            title: "Save interface settings",
            defaultPath: filename,
            filters: [{
                name: "JSON",
                extensions: ["json"],
            }],
        }).then((path) => {
            if (path != null) {
                void invoke("save_text_file", { contents, path });
            }
        }).catch(console.error);
    } else {
        const blob = new Blob([contents], { type: "application/json" });
        const link = document.createElement("a");
        const objurl = URL.createObjectURL(blob);
        link.download = filename;
        link.href = objurl;
        link.click();
    }
}

export async function loadJsonFile(): Promise<string> {
    if (fs !== undefined) {
        return await new Promise((resolve, reject) => {
            dialogOpen({
                title: "Select interface settings file",
                filters: [{
                    name: "JSON",
                    extensions: ["json"],
                }],
            }).then((path) => {
                if (path != null) {
                    invoke<string>("load_text_file", { path }).then(resolve).catch(reject);
                }
            }).catch(reject);
        });
    } else {
        return await new Promise((resolve, reject) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = () => {
                const files = input.files;
                if (files == null) reject(new Error("file not chosen"));
                else {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result as string);
                    };
                    reader.onerror = () => {
                        reject(new Error("Unable to read file"));
                    };
                    reader.readAsText(files[0], "UTF-8");
                }
            };
            input.click();
        });
    }
}
