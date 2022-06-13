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
import { appWindow } from '@tauri-apps/api/window';

import { Config, ConfigContext } from './config';
import ReactDOM from 'react-dom';
import React from 'react';
import { EventListener } from './event';
import { App } from './components/app';


async function run() {
    var config = new Config();
    await config.read();

    var eventListener = new EventListener();
    eventListener.add("app-arg", (payload) => console.log(`Got app-arg: ${payload}`));
    eventListener.finalize();
    var appnode = document.getElementById("app")!;

    appWindow.listen('tauri://close-requested', (event) => {
        ReactDOM.unmountComponentAtNode(appnode);
        config.save().then(() => {
            appWindow.close();
        });
    });

    ReactDOM.render(
        <React.StrictMode>
            <ConfigContext.Provider value={config}>
                <App />
            </ConfigContext.Provider>
        </React.StrictMode>,
        appnode);
}

window.onload = (event) => {
    run();
}
