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

import React, { lazy, Suspense } from "react";
import "@mantine/core/styles.css";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n, { initializeI18n } from "i18n";
import { isAvailableLanguage } from "i18n/language";
import type { CreateTorrentFormProps } from "components/createtorrentform";

const { appWindow, invoke } = await import(/* webpackChunkName: "taurishim" */"taurishim");

const CreateTorrentForm = lazy(async () => await import(/* webpackChunkName: "createtorrentform" */ "components/createtorrentform"));
const CustomMantineProvider = lazy(
    async () => await import("components/mantinetheme"));

interface PassEventData {
    from: string,
    payload: string,
}

interface CreateTorrentOptions extends CreateTorrentFormProps {
    language?: string,
}

async function receiveOptions() {
    let resolveOptions!: (options: CreateTorrentOptions) => void;
    let rejectOptions!: (reason: unknown) => void;
    const options = new Promise<CreateTorrentOptions>((resolve, reject) => {
        resolveOptions = resolve;
        rejectOptions = reject;
    });
    const unlisten = await appWindow.listen<PassEventData>("pass-from-window", ({ payload: data }) => {
        if (data.from !== "main") return;
        try {
            resolveOptions(JSON.parse(data.payload) as CreateTorrentOptions);
        } catch (error) {
            rejectOptions(error);
        }
    });
    window.addEventListener("unload", unlisten, { once: true });
    try {
        await invoke("pass_to_window", { to: "main", payload: "ready" });
        return await options;
    } finally {
        window.removeEventListener("unload", unlisten);
        unlisten();
    }
}

async function run() {
    const { language, ...options } = await receiveOptions();
    await initializeI18n(isAvailableLanguage(language) ? language : undefined);
    const app = createRoot(document.getElementById("app") as HTMLElement);
    app.render(
        <React.StrictMode>
            <I18nextProvider i18n={i18n}>
                <Suspense fallback={<div />}>
                    <CustomMantineProvider>
                        <CreateTorrentForm {...options} />
                    </CustomMantineProvider>
                </Suspense>
            </I18nextProvider>
        </React.StrictMode>,
    );
}

window.onload = () => {
    void run().catch(console.error);
};
