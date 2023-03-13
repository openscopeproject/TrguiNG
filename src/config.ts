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
import { merge } from "lodash";
import { SortingState, ColumnSizingState, ColumnOrderState, VisibilityState } from "@tanstack/react-table";

export interface ServerConnection {
    url: string,
    useAuth: boolean,
    username: string,
    password: string,
}

export interface PathMapping {
    from: string,
    to: string,
}

export interface ServerConfig {
    name: string,
    connection: ServerConnection,
    pathMappings: PathMapping[],
    expandedDirFilters: string[],
    lastSaveDirs: string[],
}

export interface SortByConfig {
    id: string,
    desc: boolean,
}

interface TableSettings {
    columns: string[],
    columnVisibility: Record<string, boolean>,
    columnSizes: Record<string, number>,
    sortBy: SortByConfig[],
}

type TableName = "torrents" | "filetree";

interface Settings {
    servers: ServerConfig[],
    openTabs: string[],
    app: {
        tables: Record<TableName, TableSettings>
    }
}

const DefaultSettings: Settings = {
    servers: [],
    openTabs: [],
    app: {
        tables: {
            "torrents": {
                columns: [],
                columnVisibility: {},
                columnSizes: {},
                sortBy: [],
            },
            "filetree": {
                columns: [],
                columnVisibility: {},
                columnSizes: {},
                sortBy: [],
            }
        }
    }
}

export class Config {
    fileName = "transgui-ng.json";
    values = DefaultSettings;

    async read() {
        let text = await fs.readTextFile(
            this.fileName,
            { dir: fs.BaseDirectory.Config }
        );
        merge(this.values, JSON.parse(text));

        // sanitize data
        this.values.openTabs = this.values.openTabs.filter(
            (name) => this.values.servers.find((s) => s.name == name) !== undefined
        );

        return this;
    }

    async save() {
        var configText = JSON.stringify(this.values, null, '    ');
        return fs.writeFile(
            { path: this.fileName, contents: configText },
            { dir: fs.BaseDirectory.Config }
        );
    }

    getServers(): ServerConfig[] {
        return this.values.servers;
    }

    setServers(servers: ServerConfig[]) {
        this.values.servers = servers;
    }

    getServer(name: string): ServerConfig | undefined {
        return this.values.servers.find((s) => s.name == name);
    }

    getOpenTabs() {
        return this.values.openTabs;
    }

    setOpenTabs(tabs: string[]) {
        this.values.openTabs = tabs;
    }

    setTableColumnSizes(table: TableName, sizes: ColumnSizingState) {
        this.values.app.tables[table].columnSizes = sizes;
    }

    getTableColumnSizes(table: TableName): ColumnSizingState {
        return this.values.app.tables[table].columnSizes;
    }

    setTableColumnVisibility(table: TableName, visibility: VisibilityState) {
        this.values.app.tables[table].columnVisibility = visibility;
    }

    getTableColumnVisibility(table: TableName): VisibilityState {
        return this.values.app.tables[table].columnVisibility;
    }

    setTableSortBy(table: TableName, sortBy: SortingState) {
        this.values.app.tables[table].sortBy = sortBy;
    }

    getTableSortBy(table: TableName): SortingState {
        return this.values.app.tables[table].sortBy;
    }
}

export const ConfigContext = React.createContext(new Config());
export const ServerConfigContext = React.createContext<ServerConfig>(
    {
        connection: { url: "", useAuth: false, username: "", password: "" },
        name: "", pathMappings: [], expandedDirFilters: [], lastSaveDirs: []
    }
);
