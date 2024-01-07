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
import type { ColorScheme, DefaultMantineColor } from "@mantine/core";
import { deobfuscate, obfuscate } from "trutil";
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
export type SplitType = SashName;

const FilterSections = ["Status", "Directories", "Labels", "Trackers"] as const;
export type FilterSectionName = typeof FilterSections[number];

const StatusFilters = [
    "All Torrents", "Downloading", "Completed", "Active", "Inactive", "Running", "Stopped", "Error", "Waiting", "Magnetizing",
] as const;
export type StatusFilterName = typeof StatusFilters[number];
type StatusFiltersVisibility = Record<StatusFilterName, boolean>;

const StatusbarSections = [
    "Connection", "Download speed ", "Upload speed", "Free space", "Total", "Selected",
] as const;
type StatusbarSectionName = typeof StatusbarSections[number];

const DetailsSections = [
    "General", "Files", "Pieces", "Peers", "Trackers", "<spacer>", "Server statistics",
] as const;
type DetailsSectionsName = typeof DetailsSections[number];

export type SectionsVisibility<S extends string> = Array<{
    section: S,
    visible: boolean,
}>;

export const WindowMinimizeOptions = ["minimize", "hide"] as const;
export const WindowCloseOptions = ["hide", "close", "quit"] as const;
export type WindowMinimizeOption = typeof WindowMinimizeOptions[number];
export type WindowCloseOption = typeof WindowCloseOptions[number];

export interface ColorSetting {
    color: DefaultMantineColor,
    shade: number,
}

export interface StyleOverrideColors {
    color?: ColorSetting,
    backgroundColor?: ColorSetting,
}

export interface StyleOverrides {
    dark: StyleOverrideColors,
    light: StyleOverrideColors,
    font?: string,
    color?: ColorSetting, // deprecated
    backgroundColor?: ColorSetting, // deprecated
}

interface Settings {
    servers: ServerConfig[],
    openTabs: string[],
    app: {
        window: {
            size: [number, number],
            position: [number, number] | undefined,
        },
        deleteAdded: boolean,
        toastNotifications: boolean,
        toastNotificationSound: boolean,
        showTrayIcon: boolean,
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
        statusFiltersVisibility: StatusFiltersVisibility,
        compactFolders: boolean,
        statusBarSections: SectionsVisibility<StatusbarSectionName>,
        showFiltersPanel: boolean,
        showDetailsPanel: boolean,
        detailsTabs: SectionsVisibility<DetailsSectionsName>,
        showFilesSearchBox: boolean,
        mainSplit: SplitType,
        skipAddDialog: boolean,
        numLastSaveDirs: number,
        defaultTrackers: string[],
        styleOverrides: StyleOverrides,
    },
}

const DefaultColumnVisibility: Partial<Record<TableName, VisibilityState>> = {
    torrents: {
        sizeWhenDone: false,
        leftUntilDone: false,
        downloadedEver: false,
        uploadedEver: false,
        simpleRatio: false,
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

// Based on a list from https://github.com/ngosang/trackerslist
const DefaultTrackerList = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://tracker.openbittorrent.com:6969/announce",
    "http://tracker.openbittorrent.com:80/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://open.demonii.com:1337/announce",
    "http://bt.endpot.com:80/announce",
    "udp://opentracker.i2p.rocks:6969/announce",
    "udp://open.stealth.si:80/announce",
    "udp://exodus.desync.com:6969/announce",
    "udp://tracker.moeking.me:6969/announce",
    "udp://tracker.bitsearch.to:1337/announce",
    "udp://explodie.org:6969/announce",
    "udp://uploads.gamecoast.net:6969/announce",
    "udp://tracker.theoks.net:6969/announce",
    "udp://tracker.leech.ie:1337/announce",
    "https://tracker2.ctix.cn:443/announce",
    "https://tracker1.520.jp:443/announce",
] as const;

const DefaultSettings: Settings = {
    servers: [],
    openTabs: [],
    app: {
        window: {
            size: [1024, 800],
            position: undefined,
        },
        deleteAdded: false,
        toastNotifications: true,
        toastNotificationSound: true,
        showTrayIcon: true,
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
        statusFiltersVisibility: Object.fromEntries(
            StatusFilters.map((filterName) => [
                filterName,
                !["Running", "Magnetizing"].includes(filterName),
            ]),
        ) as Record<StatusFilterName, boolean>,
        compactFolders: false,
        statusBarSections: StatusbarSections.map((section) => ({
            section,
            visible: true,
        })),
        showFiltersPanel: true,
        showDetailsPanel: true,
        detailsTabs: DetailsSections.map((section) => ({
            section,
            visible: true,
        })),
        showFilesSearchBox: false,
        mainSplit: "vertical",
        skipAddDialog: false,
        numLastSaveDirs: 20,
        defaultTrackers: [...DefaultTrackerList],
        styleOverrides: {
            dark: {},
            light: {},
        },
    },
};

export class Config {
    values = DefaultSettings;

    async read() {
        const merge = (await import(/* webpackChunkName: "lodash" */ "lodash-es/merge")).default;
        try {
            const text = await readConfigText();
            merge(this.values, JSON.parse(text));
            const overrides = this.values.interface.styleOverrides;
            if (overrides.color !== undefined) {
                overrides[this.values.interface.theme ?? "light"].color = overrides.color;
                overrides.color = undefined;
            }
            if (overrides.backgroundColor !== undefined) {
                overrides[this.values.interface.theme ?? "light"].backgroundColor = overrides.backgroundColor;
                overrides.backgroundColor = undefined;
            }
        } catch (e) {
            console.log(e);
        }

        // sanitize data
        this.values.openTabs = this.values.openTabs.filter(
            (name) => this.values.servers.find((s) => s.name === name) !== undefined,
        );

        this.values.servers = this.values.servers.map(
            (s) => ({ ...s, connection: { ...s.connection, password: deobfuscate(s.connection.password) } }));

        return this;
    }

    async save() {
        const values = { ...this.values };
        values.servers = values.servers.map(
            (s) => ({ ...s, connection: { ...s.connection, password: obfuscate(s.connection.password) } }));
        const configText = JSON.stringify(values, null, "    ");
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
        saveDirs.unshift(dir);
        while (saveDirs.length > this.values.interface.numLastSaveDirs) {
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
