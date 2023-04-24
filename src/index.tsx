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

import 'bootstrap/dist/css/bootstrap.min.css';
import { appWindow, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';

import { Config, ConfigContext } from './config';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { EventListener } from './event';
import { App } from './components/app';
import { CustomMantineProvider } from 'components/mantinetheme';
import { invoke } from '@tauri-apps/api';

async function onCloseRequested(app: Root, config: Config) {
    await config.save();
    app.unmount();
    let configs = config.getOpenServers().map((serverConfig) => ({
        name: serverConfig.name,
        connection: serverConfig.connection,
        interval: serverConfig.intervals.torrentsMinimized,
    }
    ));
    await invoke("set_poller_config", { configs });
    appWindow.emit("frontend-done");
}

async function run(config: Config) {
    var eventListener = new EventListener();
    eventListener.add("app-arg", (payload) => console.log(`Got app-arg: ${payload}`));
    eventListener.finalize();
    var appnode = document.getElementById("app")!;
    const app = createRoot(appnode);

    appWindow.onCloseRequested(async (event) => {
        onCloseRequested(app, config);
    });

    appWindow.listen("exit-requested", async(event) => {
        onCloseRequested(app, config);
    });

    appWindow.onResized(({ payload: size }) => {
        config.values.app.window.size = [size.width, size.height];
    });
    appWindow.onMoved(({ payload: size }) => {
        config.values.app.window.position = [size.x, size.y];
    });

    await appWindow.setSize(new PhysicalSize(...config.values.app.window.size));
    if (config.values.app.window.position !== undefined)
        await appWindow.setPosition(new PhysicalPosition(...config.values.app.window.position));
    else
        await appWindow.center();

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
    new Config().read().then(run);
}
