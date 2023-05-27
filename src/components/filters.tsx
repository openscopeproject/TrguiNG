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

import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Torrent } from "../rpc/torrent";
import { getTorrentError } from "../rpc/torrent";
import { Status } from "../rpc/transmission";
import * as Icon from "react-bootstrap-icons";
import * as StatusIcons from "./statusicons";
import { ServerConfigContext } from "../config";
import { Divider, Flex, Text } from "@mantine/core";
import { useForceRender } from "util";

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
        filter: (t: Torrent) => (t.error !== 0 || getTorrentError(t) !== ""),
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
];

const noLabelsFilter: LabeledFilter = {
    label: "<No labels>",
    filter: (t: Torrent) => t.labels.length === 0,
    icon: StatusIcons.Label,
};

export const DefaultFilter = statusFilters[0].filter;

interface FiltersProps {
    torrents: Torrent[],
    allLabels: string[],
    currentFilter: TorrentFilter,
    setCurrentFilter: (filter: TorrentFilter) => void,
}

interface AllFilters {
    statusFilters: LabeledFilter[],
    labelFilters: LabeledFilter[],
}

function FilterRow(props: FiltersProps & { id: string, filter: LabeledFilter }) {
    let count = 0;

    for (const torrent of props.torrents) {
        if (props.filter.filter(torrent)) count++;
    }

    return <Flex align="center" gap="sm"
        className={props.currentFilter.id === props.id ? "selected" : ""} px="xs"
        onClick={() => { props.setCurrentFilter({ id: props.id, filter: props.filter.filter }); }}>
        <props.filter.icon />
        <Text>{`${props.filter.label} (${count})`}</Text>
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

    const onExpand = useCallback(() => {
        props.dir.expanded = true;
        props.expandedReducer({ verb: "add", value: props.dir.path });
    }, [props]);
    const onCollapse = useCallback(() => {
        props.dir.expanded = false;
        props.expandedReducer({ verb: "remove", value: props.dir.path });
    }, [props]);

    const expandable = props.dir.subdirs.size > 0;

    return (
        <div className="d-flex flex-row align-items-center"
            style={{ paddingLeft: `${props.dir.level * 1.4 + 0.25}em`, cursor: "default" }}>
            <div className="flex-shrink-0">
                {expandable
                    ? props.dir.expanded
                        ? <Icon.DashSquare size={16} onClick={onCollapse} style={{ cursor: "pointer" }} />
                        : <Icon.PlusSquare size={16} onClick={onExpand} style={{ cursor: "pointer" }} />
                    : <Icon.Folder size={16} />
                }
            </div>
            <div
                className={`ms-1 ps-1 flex-grow-1 ${props.currentFilter.id === props.id ? " bg-primary text-white" : ""}`}
                onClick={() => { props.setCurrentFilter({ id: props.id, filter }); }}>
                {`${props.dir.name} (${props.dir.count})`}
            </div>
        </div>
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

export function Filters(props: FiltersProps) {
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

    const [dirs, setDirs] = useState<Directory[]>([]);

    useEffect(() => {
        const tree = buildDirTree(paths, serverConfig.expandedDirFilters);
        setDirs(flattenTree(tree));
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
        return {
            statusFilters,
            labelFilters,
        };
    }, [props.allLabels]);

    return (
        <div className='w-100 filter-container'>
            <Divider mx="sm" label="Status" labelPosition="center" />
            {allFilters.statusFilters.map((f) =>
                <FilterRow key={`status-${f.label}`} id={`status-${f.label}`}
                    filter={f} {...props} />)}
            <Divider mx="sm" mt="md" label="Directories" labelPosition="center" />
            {paths.length > 0
                ? dirs.map((d) =>
                    <DirFilterRow key={`dir-${d.path}`} id={`dir-${d.path}`}
                        dir={d} expandedReducer={expandedReducer} {...props} />)
                : <></>
            }
            <Divider mx="sm" mt="md" label="Labels" labelPosition="center" />
            {allFilters.labelFilters.map((f) =>
                <FilterRow key={`labels-${f.label}`} id={`labels-${f.label}`}
                    filter={f} {...props} />)}
        </div>
    );
}
