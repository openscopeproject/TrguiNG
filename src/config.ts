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

import React from "react";
import type {
    SortingState, ColumnSizingState, VisibilityState, ColumnOrderState,
} from "@tanstack/react-table";
import type { ColorScheme } from "@mantine/core";
const { readConfigText, writeConfigText } = await import(/* webpackChunkName: "taurishim" */"taurishim");

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
    columnOrder: string[],
    columnSizes: Record<string, number>,
    sortBy: SortByConfig[],
}

const TableNames = ["torrents", "filetree", "filetreebrief", "trackers", "peers"] as const;
export type TableName = typeof TableNames[number];

const Sashes = ["vertical", "horizontal"] as const;
type SashName = typeof Sashes[number];

const FilterSections = ["Status", "Directories", "Labels", "Trackers"] as const;
export type FilterSectionName = typeof FilterSections[number];

const StatusbarSections = [
    "Connection", "Download speed ", "Upload speed", "Free space", "Total", "Selected",
] as const;
type StatusbarSectionName = typeof StatusbarSections[number];

export type SectionsVisibility<S extends string> = Array<{
    section: S,
    visible: boolean,
}>;

export const WindowMinimizeOptions = ["minimize", "hide"] as const;
export const WindowCloseOptions = ["hide", "close", "quit"] as const;
export type WindowMinimizeOption = typeof WindowMinimizeOptions[number];
export type WindowCloseOption = typeof WindowCloseOptions[number];

interface Settings {
    servers: ServerConfig[],
    openTabs: string[],
    app: {
        window: {
            size: [number, number],
            position: [number, number] | undefined,
        },
        numLastSaveDirs: number,
        deleteAdded: boolean,
        toastNotifications: boolean,
        onMinimize: WindowMinimizeOption,
        onClose: WindowCloseOption,
        fontSizeBase: number,
        fontSize: number,
    },
    interface: {
        theme: ColorScheme | undefined,
        tables: Record<TableName, TableSettings>,
        sashSizes: Record<SashName, [number, number]>,
        filterSections: SectionsVisibility<FilterSectionName>,
        statusBarSections: SectionsVisibility<StatusbarSectionName>,
        showFiltersPanel: boolean,
        showDetailsPanel: boolean,
    },
}

const DefaultColumnVisibility: Partial<Record<TableName, VisibilityState>> = {
    torrents: {
        sizeWhenDone: false,
        leftUntilDone: false,
        downloadedEver: false,
        uploadedEver: false,
        eta: false,
        tracker: false,
        trackerStatus: false,
        doneDate: false,
        activityDate: false,
        downloadDir: false,
        id: false,
        queuePosition: false,
        isPrivate: false,
        group: false,
        "file-count": false,
        pieceCount: false,
        metadataPercentComplete: false,
    },
    peers: {
        flagStr: false,
        cachedFrom: false,
        cachedConnection: false,
        cachedProtocol: false,
    },
} as const;

const DefaultSettings: Settings = {
    servers: [],
    openTabs: [],
    app: {
        window: {
            size: [1024, 800],
            position: undefined,
        },
        numLastSaveDirs: 20,
        deleteAdded: false,
        toastNotifications: true,
        onMinimize: "minimize",
        onClose: "quit",
        fontSizeBase: 0.9,
        fontSize: 0.9,
    },
    interface: {
        theme: undefined,
        tables: Object.fromEntries(TableNames.map((table) => [table, {
            columns: [],
            columnVisibility: DefaultColumnVisibility[table] ?? {},
            columnOrder: [],
            columnSizes: {},
            sortBy: [],
        }])) as unknown as Record<TableName, TableSettings>,
        sashSizes: {
            vertical: [70, 30],
            horizontal: [20, 80],
        },
        filterSections: FilterSections.map((section) => ({
            section,
            visible: true,
        })),
        statusBarSections: StatusbarSections.map((section) => ({
            section,
            visible: true,
        })),
        showFiltersPanel: true,
        showDetailsPanel: true,
    },
};

export class Config {
    values = DefaultSettings;

    async read() {
        const merge = (await import(/* webpackChunkName: "lodash" */ "lodash-es/merge")).default;
        try {
            const text = await readConfigText();
            merge(this.values, JSON.parse(text));
        } catch (e) {
            console.log(e);
        }

        // sanitize data
        this.values.openTabs = this.values.openTabs.filter(
            (name) => this.values.servers.find((s) => s.name === name) !== undefined,
        );

        return this;
    }

    async save() {
        const configText = JSON.stringify(this.values, null, "    ");
        await writeConfigText(configText);
    }

    getTheme() {
        return this.values.interface.theme;
    }

    setTheme(value: ColorScheme) {
        this.values.interface.theme = value;
    }

    getSashSizes(sash: SashName) {
        return this.values.interface.sashSizes[sash];
    }

    setSashSizes(sash: SashName, sizes: [number, number]) {
        this.values.interface.sashSizes[sash] = sizes;
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
        this.values.interface.tables[table].columnSizes = sizes;
    }

    getTableColumnSizes(table: TableName): ColumnSizingState {
        return this.values.interface.tables[table].columnSizes;
    }

    setTableColumnVisibility(table: TableName, visibility: VisibilityState) {
        this.values.interface.tables[table].columnVisibility = visibility;
    }

    getTableColumnVisibility(table: TableName): VisibilityState {
        return this.values.interface.tables[table].columnVisibility;
    }

    setTableColumnOrder(table: TableName, order: ColumnOrderState) {
        this.values.interface.tables[table].columnOrder = order;
    }

    getTableColumnOrder(table: TableName): ColumnOrderState {
        return this.values.interface.tables[table].columnOrder;
    }

    setTableSortBy(table: TableName, sortBy: SortingState) {
        this.values.interface.tables[table].sortBy = sortBy;
    }

    getTableSortBy(table: TableName): SortingState {
        return this.values.interface.tables[table].sortBy;
    }

    addSaveDir(serverName: string, dir: string) {
        const saveDirs = this.getServer(serverName)?.lastSaveDirs;
        if (saveDirs === undefined) return;
        const index = saveDirs.findIndex((d) => d === dir);
        if (index >= 0) saveDirs.splice(index, 1);
        if (saveDirs.unshift(dir) > this.values.app.numLastSaveDirs) {
            saveDirs.pop();
        }
    }
}

export const ConfigContext = React.createContext(new Config());
export const ServerConfigContext = React.createContext<ServerConfig>({
    connection: { url: "", username: "", password: "" },
    name: "",
    pathMappings: [],
    expandedDirFilters: [],
    lastSaveDirs: [],
    intervals: { session: 0, torrents: 0, torrentsMinimized: 0, details: 0 },
});
