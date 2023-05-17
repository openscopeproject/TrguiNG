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

import type { ServerConfig, Config } from "./config";
import { TransmissionClient } from "./rpc/client";

export class ClientManager {
    clients = new Map<string, TransmissionClient>();
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    open(server: string) {
        if (this.clients.has(server)) return;

        const serverConfig = this.config.getServer(server) as ServerConfig;
        const client = new TransmissionClient(serverConfig.connection);

        this.clients.set(server, client);

        void client.getSessionFull();
    }

    close(server: string) {
        if (this.clients.has(server)) return;
        this.clients.delete(server);
    }

    getClient(server: string) {
        return this.clients.get(server) as TransmissionClient;
    }

    getHostname(server: string) {
        return this.getClient(server).hostname;
    }
}
