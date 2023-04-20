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

import { Config } from "./config";
import { TransmissionClient } from "./rpc/client";

interface ServerEntry {
    client: TransmissionClient;
}

export class ClientManager {
    servers: Record<string, ServerEntry> = {};
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    open(server: string) {
        if (server in this.servers) return;

        var serverConfig = this.config.getServer(server)!;
        this.servers[server] = {
            client: new TransmissionClient(serverConfig.connection),
        }
        this.servers[server].client.getSessionFull();
    }

    close(server: string) {
        if (!(server in this.servers)) return;
        delete this.servers[server];
    }

    getClient(server: string) {
        return this.servers[server].client;
    }

    getHostname(server: string) {
        return this.servers[server].client.hostname;
    }
}
