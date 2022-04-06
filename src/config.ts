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

import * as fs from "@tauri-apps/api/fs";
import React from "react";

export interface ServerConnection {
    url: string,
    username: string,
    password: string,
}

export interface Server {
    name: string,
    connection: ServerConnection,
    pathMappings: [
        {
            from: string,
            to: string,
        }
    ]
}

interface Settings {
    servers: Server[],
    app: {
        tables: Record<string, TableFieldConfig[]>
    }
}

export interface TableFieldConfig {
    name: string
    width: number
}

const DefaultSettings: Settings =  {
    servers: [],
    app: {
        tables: {
            "torrent": [],
        }
    }
}

export class Config {
    fileName = "transgui-ng.json";
    values = DefaultSettings;

    async read() {
        return fs.readTextFile(
            this.fileName,
            { dir: fs.BaseDirectory.Config }
        ).then((text) => {
            console.log(`Read ${text}`);
            this.values = JSON.parse(text);
        }).catch((e) => console.log(e));
    }

    async save() {
        var configText = JSON.stringify(this.values, null, '    ');
        return fs.writeFile(
            { path: this.fileName, contents: configText },
            { dir: fs.BaseDirectory.Config }
        );
    }

    getServers(): Server[] {
        return this.values.servers;
    }

    getConnection(serverName: string): ServerConnection | null {
        var server = this.values.servers.find((c) => c.name == serverName);
        return server ? server.connection : null;
    }

    setTableFields(table: "torrents", fields: TableFieldConfig[]) {
        this.values.app.tables[table] = fields;
    }

    getTableFields(table: "torrents"): TableFieldConfig[] {
        return this.values.app.tables[table];
    }
}

export const ConfigContext = React.createContext(new Config());
