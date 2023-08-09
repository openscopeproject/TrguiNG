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

import type { OpenDialogOptions } from "@tauri-apps/api/dialog";
import type { EventCallback } from "@tauri-apps/api/event";
import type { CloseRequestedEvent, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";

export const TAURI = Object.prototype.hasOwnProperty.call(window, "__TAURI__");
const realAppWindow = TAURI ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api/window")).appWindow : undefined;
const WebviewWindow = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api/window")).WebviewWindow
    : undefined;
const fs = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api")).fs
    : undefined;
const clipboard = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api")).clipboard
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
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api")).invoke
    : async <T>(c: string, a: unknown) =>
        await Promise.reject<T>(new Error("Running outside of tauri app"));

export const dialogOpen = TAURI
    ? (await import(/* webpackMode: "lazy-once" */ "@tauri-apps/api/dialog")).open
    : async (options?: OpenDialogOptions) =>
        await Promise.reject<string[] | string | null>(new Error("Running outside of tauri app"));

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
        return await fs.readTextFile(configFile, { dir: fs.BaseDirectory.Config });
    } else {
        return localStorage.getItem("trguing-config") ?? "{}";
    }
}

export async function writeConfigText(contents: string) {
    if (fs !== undefined) {
        await fs.writeFile(
            { path: configFile, contents },
            { dir: fs.BaseDirectory.Config },
        );
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
            console.log("Can not copy to clipboard.");
        }

        document.body.removeChild(textArea);
    }
}
