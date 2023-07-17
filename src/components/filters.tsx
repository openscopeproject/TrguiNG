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

import React, { useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { Torrent } from "../rpc/torrent";
import { Status } from "../rpc/transmission";
import * as Icon from "react-bootstrap-icons";
import * as StatusIcons from "./statusicons";
import type { FilterSectionName, SectionsVisibility } from "../config";
import { ConfigContext, ServerConfigContext } from "../config";
import { Divider, Flex } from "@mantine/core";
import { eventHasModKey, useForceRender } from "trutil";
import { useContextMenu } from "./contextmenu";
import { SectionsContextMenu, getSectionsMap } from "./sectionscontextmenu";

export interface TorrentFilter {
    id: string,
    filter: (t: Torrent) => boolean,
}

interface LabeledFilter {
    label: string,
    filter: (t: Torrent) => boolean,
    icon: React.ComponentType,
}

const statusFilters: LabeledFilter[] = [
    {
        label: "All Torrents",
        filter: (t: Torrent) => true,
        icon: StatusIcons.All,
    },
    {
        label: "Downloading",
        filter: (t: Torrent) => t.status === Status.downloading,
        icon: StatusIcons.Downloading,
    },
    {
        label: "Completed",
        filter: (t: Torrent) => {
            return t.status === Status.seeding ||
                (t.sizeWhenDone > 0 && Math.max(t.sizeWhenDone - t.haveValid, 0) === 0);
        },
        icon: StatusIcons.Completed,
    },
    {
        label: "Active",
        filter: (t: Torrent) => {
            return t.rateDownload > 0 || t.rateUpload > 0;
        },
        icon: StatusIcons.Active,
    },
    {
        label: "Inactive",
        filter: (t: Torrent) => {
            return t.rateDownload === 0 && t.rateUpload === 0 && t.status !== Status.stopped;
        },
        icon: StatusIcons.Inactive,
    },
    {
        label: "Stopped",
        filter: (t: Torrent) => t.status === Status.stopped,
        icon: StatusIcons.Stopped,
    },
    {
        label: "Error",
        filter: (t: Torrent) => (t.error !== 0 || t.cachedError !== ""),
        icon: StatusIcons.Error,
    },
    {
        label: "Waiting",
        filter: (t: Torrent) => [
            Status.verifying,
            Status.queuedToVerify,
            Status.queuedToDownload].includes(t.status),
        icon: StatusIcons.Waiting,
    },
    {
        label: "Magnetizing",
        filter: (t: Torrent) => t.status === Status.downloading && t.pieceCount === 0,
        icon: StatusIcons.Magnetizing,
    },
];

const noLabelsFilter: LabeledFilter = {
    label: "<No labels>",
    filter: (t: Torrent) => t.labels?.length === 0,
    icon: StatusIcons.Label,
};

export const DefaultFilter = statusFilters[0].filter;

interface FiltersProps {
    torrents: Torrent[],
    allLabels: string[],
    allTrackers: string[],
    currentFilters: TorrentFilter[],
    setCurrentFilters: React.Dispatch<{
        verb: "set" | "toggle",
        filter: TorrentFilter,
    }>,
}

interface AllFilters {
    statusFilters: LabeledFilter[],
    labelFilters: LabeledFilter[],
    trackerFilters: LabeledFilter[],
}

function FilterRow(props: FiltersProps & { id: string, filter: LabeledFilter }) {
    let count = 0;

    for (const torrent of props.torrents) {
        if (props.filter.filter(torrent)) count++;
    }

    return <Flex align="center" gap="sm" px="xs"
        className={props.currentFilters.find((f) => f.id === props.id) !== undefined ? "selected" : ""}
        onClick={(event) => {
            props.setCurrentFilters({
                verb: eventHasModKey(event) ? "toggle" : "set",
                filter: { id: props.id, filter: props.filter.filter },
            });
        }}>
        <div style={{ flexShrink: 0 }}><props.filter.icon /></div>
        <div style={{ flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{props.filter.label}</div>
        <div style={{ flexShrink: 0 }}>{`(${count})`}</div>
    </Flex>;
}

interface DirFilterRowProps extends FiltersProps {
    id: string,
    dir: Directory,
    expandedReducer: ({ verb, value }: { verb: "add" | "remove", value: string }) => void,
}

function DirFilterRow(props: DirFilterRowProps) {
    const filter = useCallback((t: Torrent) => {
        const path = t.downloadDir as string;
        if (path.length + 1 === props.dir.path.length) return props.dir.path.startsWith(path);
        return path.startsWith(props.dir.path);
    }, [props.dir.path]);

    const onExpand = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        props.dir.expanded = true;
        props.expandedReducer({ verb: "add", value: props.dir.path });
    }, [props]);
    const onCollapse = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        props.dir.expanded = false;
        props.expandedReducer({ verb: "remove", value: props.dir.path });
    }, [props]);

    const expandable = props.dir.subdirs.size > 0;

    return (
        <Flex align="center" gap="sm"
            style={{ paddingLeft: `${props.dir.level * 1.4 + 0.25}em`, cursor: "default" }}
            className={props.currentFilters.find((f) => f.id === props.id) !== undefined ? "selected" : ""}
            onClick={(event) => {
                props.setCurrentFilters({
                    verb: eventHasModKey(event) ? "toggle" : "set",
                    filter: { id: props.id, filter },
                });
            }}>
            <div style={{ flexShrink: 0 }}>
                {expandable
                    ? props.dir.expanded
                        ? <Icon.DashSquare size="1.1rem" onClick={onCollapse} style={{ cursor: "pointer" }} />
                        : <Icon.PlusSquare size="1.1rem" onClick={onExpand} style={{ cursor: "pointer" }} />
                    : <Icon.Folder size="1.1rem" />
                }
            </div>
            <div style={{ flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{props.dir.name}</div>
            <div style={{ flexShrink: 0 }}>{`(${props.dir.count})`}</div>
        </Flex>
    );
}

interface Directory {
    name: string,
    path: string,
    subdirs: Map<string, Directory>,
    expanded: boolean,
    count: number,
    level: number,
}

const DefaultRoot: Directory = {
    name: "",
    path: "",
    subdirs: new Map(),
    expanded: true,
    count: 0,
    level: -1,
};

function buildDirTree(paths: string[], expanded: string[]): Directory {
    const root: Directory = { ...DefaultRoot, subdirs: new Map() };

    paths.forEach((path) => {
        const parts = path.split("/");
        let dir = root;
        let currentPath = "/";
        for (const part of parts) {
            if (part === "") continue;
            currentPath = currentPath + part + "/";
            if (!dir.subdirs.has(part)) {
                dir.subdirs.set(part, {
                    name: part,
                    path: currentPath,
                    subdirs: new Map(),
                    expanded: expanded.includes(currentPath),
                    count: 0,
                    level: dir.level + 1,
                });
            }
            dir = dir.subdirs.get(part) as Directory;
            dir.count++;
        }
    });

    return root;
}

function flattenTree(root: Directory): Directory[] {
    const result: Directory[] = [];
    const append = (dir: Directory) => {
        dir.subdirs.forEach((d) => {
            result.push(d);
            if (d.expanded) append(d);
        });
    };
    append(root);
    return result;
}

export const Filters = React.memo(function Filters(props: FiltersProps) {
    const config = useContext(ConfigContext);
    const serverConfig = useContext(ServerConfigContext);
    const forceRender = useForceRender();

    const expandedReducer = useCallback(
        ({ verb, value }: { verb: "add" | "remove" | "set", value: string | string[] }) => {
            if (verb === "add") {
                serverConfig.expandedDirFilters = [...serverConfig.expandedDirFilters, value as string];
            } else {
                const idx = serverConfig.expandedDirFilters.indexOf(value as string);
                serverConfig.expandedDirFilters = [
                    ...serverConfig.expandedDirFilters.slice(0, idx),
                    ...serverConfig.expandedDirFilters.slice(idx + 1),
                ];
            }
            forceRender();
        }, [forceRender, serverConfig]);

    const paths = useMemo(
        () => props.torrents.map((t) => t.downloadDir as string).sort(),
        [props.torrents]);

    const dirs = useMemo<Directory[]>(() => {
        const tree = buildDirTree(paths, serverConfig.expandedDirFilters);
        return flattenTree(tree);
    }, [paths, serverConfig.expandedDirFilters]);

    const allFilters = useMemo<AllFilters>(() => {
        const labelFilters: LabeledFilter[] = [noLabelsFilter];
        props.allLabels.forEach((label) => {
            labelFilters.push({
                label,
                filter: (t: Torrent) => t.labels.includes(label),
                icon: StatusIcons.Label,
            });
        });
        const trackerFilters: LabeledFilter[] = [];
        props.allTrackers.forEach((tracker) => {
            trackerFilters.push({
                label: tracker,
                filter: (t: Torrent) => t.cachedMainTracker === tracker,
                icon: StatusIcons.Tracker,
            });
        });
        return {
            statusFilters,
            labelFilters,
            trackerFilters,
        };
    }, [props.allLabels, props.allTrackers]);

    const [sections, setSections] = useReducer(
        (_: SectionsVisibility<FilterSectionName>, sections: SectionsVisibility<FilterSectionName>) => {
            props.setCurrentFilters({ verb: "set", filter: { id: "", filter: DefaultFilter } });
            return sections;
        }, config.values.interface.filterSections);
    const [sectionsMap, setSectionsMap] = useState(getSectionsMap(sections));

    useEffect(() => {
        config.values.interface.filterSections = sections;
        setSectionsMap(getSectionsMap(sections));
    }, [config, sections]);

    const [info, setInfo, handler] = useContextMenu();

    return (
        <Flex direction="column" style={{ width: "100%", whiteSpace: "nowrap", cursor: "default", userSelect: "none" }} onContextMenu={handler}>
            <SectionsContextMenu
                sections={sections} setSections={setSections}
                contextMenuInfo={info} setContextMenuInfo={setInfo} />
            {sections[sectionsMap.Status].visible && <div style={{ order: sectionsMap.Status }}>
                <Divider mx="sm" label="Status" labelPosition="center" />
                {allFilters.statusFilters.map((f) =>
                    <FilterRow key={`status-${f.label}`} id={`status-${f.label}`}
                        filter={f} {...props} />)}
            </div>}
            {sections[sectionsMap.Directories].visible && <div style={{ order: sectionsMap.Directories }}>
                <Divider mx="sm" mt="md" label="Directories" labelPosition="center" />
                {dirs.map((d) =>
                    <DirFilterRow key={`dir-${d.path}`} id={`dir-${d.path}`}
                        dir={d} expandedReducer={expandedReducer} {...props} />)}
            </div>}
            {sections[sectionsMap.Labels].visible && <div style={{ order: sectionsMap.Labels }}>
                <Divider mx="sm" mt="md" label="Labels" labelPosition="center" />
                {allFilters.labelFilters.map((f) =>
                    <FilterRow key={`labels-${f.label}`} id={`labels-${f.label}`}
                        filter={f} {...props} />)}
            </div>}
            {sections[sectionsMap.Trackers].visible && <div style={{ order: sectionsMap.Trackers }}>
                <Divider mx="sm" mt="md" label="Trackers" labelPosition="center" />
                {allFilters.trackerFilters.map((f) =>
                    <FilterRow key={`trackers-${f.label}`} id={`trackers-${f.label}`}
                        filter={f} {...props} />)}
            </div>}
        </Flex>
    );
});
