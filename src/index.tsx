/**
 * transgui-ng - next gen remote GUI for transmission torrent daemon
 * Copyright (C) 2022  qu1ck (mail at qu1ck.org)
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

import { appWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";

import { Config, ConfigContext } from "./config";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import React, { lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api";
import { emit } from "@tauri-apps/api/event";

const App = lazy(async () => await import(/* webpackChunkName: "app" */ "components/app"));
const CustomMantineProvider = lazy(
    async () => await import(/* webpackChunkName: "app" */ "components/mantinetheme"));

async function onCloseRequested(app: Root, config: Config) {
    await config.save();
    await emit("listener-pause", {});
    app.unmount();
    const configs = config.getOpenServers().map((serverConfig) => ({
        name: serverConfig.name,
        connection: serverConfig.connection,
        interval: serverConfig.intervals.torrentsMinimized,
    }
    ));
    await invoke("set_poller_config", { configs });
    void appWindow.emit("frontend-done");
}

async function onFocusChange(focused: boolean, config: Config) {
    if (!focused && config.values.app.onMinimize === "hide") {
        if (await appWindow.isMinimized()) {
            console.log("Hiding window");
            void appWindow.hide();
        }
    }
}

async function run(config: Config) {
    const appnode = document.getElementById("app") as HTMLElement;
    const app = createRoot(appnode);

    void appWindow.onCloseRequested((event) => {
        if (config.values.app.onClose === "hide") {
            event.preventDefault();
            void appWindow.hide();
        } else if (config.values.app.onClose === "quit") {
            event.preventDefault();
            config.save().finally(() => {
                void emit("app-exit");
            });
        } else {
            void onCloseRequested(app, config);
        }
    });

    void appWindow.listen("exit-requested", (event) => {
        void onCloseRequested(app, config);
    });

    void appWindow.onFocusChanged(({ payload: focused }) => {
        void onFocusChange(focused, config);
    });

    void appWindow.onResized(({ payload: size }) => {
        config.values.app.window.size = [size.width, size.height];
    });
    void appWindow.onMoved(({ payload: size }) => {
        config.values.app.window.position = [size.x, size.y];
    });

    await appWindow.setSize(new PhysicalSize(...config.values.app.window.size));
    if (config.values.app.window.position !== undefined) {
        await appWindow.setPosition(new PhysicalPosition(...config.values.app.window.position));
    } else {
        await appWindow.center();
    }

    app.render(
        <React.StrictMode>
            <ConfigContext.Provider value={config}>
                <Suspense fallback={<div />}>
                    <CustomMantineProvider>
                        <App />
                    </CustomMantineProvider>
                </Suspense>
            </ConfigContext.Provider>
        </React.StrictMode>
    );
}

window.onload = (event) => {
    new Config().read().then(run).catch(console.error);
};
