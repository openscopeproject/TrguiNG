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

import "bootstrap/dist/css/bootstrap.min.css";
import { appWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";

import { Config, ConfigContext } from "./config";
import { createRoot, type Root } from "react-dom/client";
import React from "react";
import { App } from "./components/app";
import { CustomMantineProvider } from "components/mantinetheme";
import { invoke } from "@tauri-apps/api";
import { emit } from "@tauri-apps/api/event";

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

async function run(config: Config) {
    const appnode = document.getElementById("app") as HTMLElement;
    const app = createRoot(appnode);

    void appWindow.onCloseRequested((event) => {
        void onCloseRequested(app, config);
    });

    void appWindow.listen("exit-requested", (event) => {
        void onCloseRequested(app, config);
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
                <CustomMantineProvider>
                    <App />
                </CustomMantineProvider>
            </ConfigContext.Provider>
        </React.StrictMode>
    );
}

window.onload = (event) => {
    new Config().read().then(run).catch(console.error);
};
