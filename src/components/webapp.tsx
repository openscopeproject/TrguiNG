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

import { ClientManager } from "clientmanager";
import type { ServerConfig } from "config";
import { ConfigContext, ServerConfigContext } from "config";
import React, { useContext, useMemo } from "react";
import { ClientContext } from "rpc/client";
import { Server } from "./server";
import { App } from "./app";

export default function WebApp() {
    const config = useContext(ConfigContext);

    const { server, clientManager } = useMemo(() => {
        const server: ServerConfig = config.values.servers.length > 0
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
            config.values.servers.push(server);
        }

        const clientManager = new ClientManager(config);
        clientManager.open(server.name, false);

        return { server, clientManager };
    }, [config]);

    return (
        <App>
            <ServerConfigContext.Provider value={server}>
                <ClientContext.Provider value={clientManager.getClient(server.name)}>
                    <Server hostname={clientManager.getHostname(server.name)} />
                </ClientContext.Provider>
            </ServerConfigContext.Provider>
        </App>
    );
}
