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

import React, { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Config, ConfigContext } from "config";
import i18n, { initializeI18n } from "i18n";
import CreateTorrentForm from "./createtorrentform";
import CustomMantineProvider from "./mantinetheme";
import "@mantine/core/styles.css";

export default function CreateTorrentApp() {
    const [config, setConfig] = useState<Config>();
    useEffect(() => {
        let active = true;
        const initialize = async () => {
            const loaded = await new Config().read();
            await initializeI18n(loaded.values.app.language);
            if (active) setConfig(loaded);
        };
        void initialize().catch(console.error);
        return () => {
            active = false;
        };
    }, []);
    if (config === undefined) return <div />;
    return (
        <I18nextProvider i18n={i18n}>
            <ConfigContext.Provider value={config}>
                <CustomMantineProvider><CreateTorrentForm /></CustomMantineProvider>
            </ConfigContext.Provider>
        </I18nextProvider>
    );
}
