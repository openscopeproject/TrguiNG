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
import { merge } from "lodash-es";
import { type SortingState, type ColumnSizingState, type VisibilityState } from "@tanstack/react-table";
import { type ColorScheme } from "@mantine/core";

export interface ServerConnection {
    url: string,
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
    intervals: {
        session: number,
        torrents: number,
        torrentsMinimized: number,
        details: number,
    },
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

const TableNames = ["torrents", "filetree", "filetreebrief", "trackers", "peers"] as const;
export type TableName = typeof TableNames[number];

const Sashes = ["vertical", "horizontal"] as const;
export type SashName = typeof Sashes[number];

interface Settings {
    servers: ServerConfig[],
    openTabs: string[],
    app: {
        tables: Record<TableName, TableSettings>,
        sashSizes: Record<SashName, [number, number]>,
        window: {
            size: [number, number],
            position: [number, number] | undefined,
            theme: ColorScheme | undefined,
        },
    },
}

const DefaultSettings: Settings = {
    servers: [],
    openTabs: [],
    app: {
        tables: Object.fromEntries(TableNames.map((table) => [table, {
            columns: [],
            columnVisibility: {},
            columnSizes: {},
            sortBy: [],
        }])) as unknown as Record<TableName, TableSettings>,
        sashSizes: {
            vertical: [70, 30],
            horizontal: [20, 80],
        },
        window: {
            size: [1024, 800],
            position: undefined,
            theme: undefined,
        },
    }
};

export class Config {
    fileName = "transgui-ng.json";
    values = DefaultSettings;

    async read() {
        const text = await fs.readTextFile(
            this.fileName,
            { dir: fs.BaseDirectory.Config }
        );
        merge(this.values, JSON.parse(text));

        // sanitize data
        this.values.openTabs = this.values.openTabs.filter(
            (name) => this.values.servers.find((s) => s.name === name) !== undefined
        );

        return this;
    }

    async save() {
        const configText = JSON.stringify(this.values, null, "    ");
        await fs.writeFile(
            { path: this.fileName, contents: configText },
            { dir: fs.BaseDirectory.Config }
        );
    }

    getServers(): ServerConfig[] {
        return this.values.servers;
    }

    getOpenServers(): ServerConfig[] {
        return this.values.servers.filter((s) => this.values.openTabs.includes(s.name));
    }

    setServers(servers: ServerConfig[]) {
        this.values.servers = servers;
    }

    getServer(name: string): ServerConfig | undefined {
        return this.values.servers.find((s) => s.name === name);
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
        connection: { url: "", username: "", password: "" },
        name: "",
        pathMappings: [],
        expandedDirFilters: [],
        lastSaveDirs: [],
        intervals: { session: 0, torrents: 0, torrentsMinimized: 0, details: 0 },
    }
);
