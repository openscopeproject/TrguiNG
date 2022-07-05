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
import { ActionType, TableState } from "react-table";

export interface ServerConnection {
    url: string,
    useAuth: boolean,
    username: string,
    password: string,
}

export interface ServerConfig {
    name: string,
    connection: ServerConnection,
    pathMappings:
    {
        from: string,
        to: string,
    }[],
    expandedDirFilters: string[],
    lastSaveDirs: string[],
}

export interface TableFieldConfig {
    name: string
    width: number
}

export interface SortByConfig {
    id: string,
    desc: boolean,
}

interface TableSettings {
    fields: TableFieldConfig[],
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
                fields: [],
                sortBy: [],
            },
            "filetree": {
                fields: [],
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

    setTableFields(table: TableName, fields: TableFieldConfig[]) {
        this.values.app.tables[table].fields = fields;
    }

    getTableFields(table: TableName): TableFieldConfig[] {
        return this.values.app.tables[table].fields;
    }

    setTableSortBy(table: TableName, sortBy: SortByConfig[]) {
        this.values.app.tables[table].sortBy = sortBy;
    }

    getTableSortBy(table: TableName): SortByConfig[] {
        return this.values.app.tables[table].sortBy;
    }

    processTableStateChange<T extends object>(
        table: TableName, defaultOrder: string[], state: TableState<T>, action: ActionType
    ) {
        // console.log("Table state reducer", action);
        if (action.type == "columnDoneResizing") {
            const order =
                (state.columnOrder !== undefined && state.columnOrder.length > 0)
                    ? state.columnOrder : defaultOrder;
            const visible = order.filter(
                (f) => state.hiddenColumns ? !state.hiddenColumns.includes(f) : true);
            const oldFields = this.getTableFields(table);
            const fields: TableFieldConfig[] = visible.map((f) => {
                const newWidths = state.columnResizing.columnWidths;
                var width = 150;
                var oldField = oldFields.find((oldfield) => oldfield.name == f);
                if (oldField) width = oldField.width;
                if (f in newWidths) width = newWidths[f];
                return {
                    name: f,
                    width
                }
            });
            this.setTableFields(table, fields);
        }

        if (action.type == "toggleSortBy") {
            this.setTableSortBy(table, state.sortBy.map((r) => {
                return { id: r.id, desc: r.desc || false };
            }));
        }
    }
}

export const ConfigContext = React.createContext(new Config());
export const ServerConfigContext = React.createContext<ServerConfig>(
    {
        connection: { url: "", useAuth: false, username: "", password: "" },
        name: "", pathMappings: [], expandedDirFilters: [], lastSaveDirs: []
    }
);
