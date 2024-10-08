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

import type { ServerConfig } from "config";
import { ConfigContext, ServerConfigContext } from "config";
import React, { useContext, useMemo, useRef } from "react";
import { ClientContext, TransmissionClient } from "rpc/client";
import { Server } from "./server";
import { App } from "./app";
import type { ServerTabsRef } from "./servertabs";

export default function WebApp() {
    const config = useContext(ConfigContext);

    const { serverConfig, client } = useMemo(() => {
        const serverConfig: ServerConfig = config.values.servers.length > 0
            ? config.values.servers[0]
            : {
                name: "transmission",
                connection: { url: "", username: "", password: "" },
                expandedDirFilters: [],
                lastSaveDirs: [],
                pathMappings: [],
                intervals: { session: 60, torrents: 5, torrentsMinimized: 60, details: 5 },
            };

        if (config.values.servers.length === 0) {
            config.values.servers.push(serverConfig);
        }

        const client = new TransmissionClient(serverConfig.connection, false, false);

        return { serverConfig, client };
    }, [config]);

    const tabsRef = useRef<ServerTabsRef>(null);

    return (
        <App>
            <ServerConfigContext.Provider value={serverConfig}>
                <ClientContext.Provider value={client}>
                    <Server hostname={client.hostname} tabsRef={tabsRef} toggleTabStrip={() => { }} />
                </ClientContext.Provider>
            </ServerConfigContext.Provider>
        </App>
    );
}
