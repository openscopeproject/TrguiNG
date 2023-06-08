/**
 * TransguiNG - next gen remote GUI for transmission torrent daemon
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

import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

const CreateTorrentForm = lazy(async () => await import(/* webpackChunkName: "createtorrentform" */ "components/createtorrentform"));
const CustomMantineProvider = lazy(
    async () => await import(/* webpackChunkName: "app" */ "components/mantinetheme"));

async function run() {
    const appnode = document.getElementById("app") as HTMLElement;
    const app = createRoot(appnode);

    app.render(
        <React.StrictMode>
            <Suspense fallback={<div />}>
                <CustomMantineProvider>
                    <CreateTorrentForm />
                </CustomMantineProvider>
            </Suspense>
        </React.StrictMode>);
}

window.onload = run;
