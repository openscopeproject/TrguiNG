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

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import '../css/filters.css';
import { getTorrentError, Torrent } from '../rpc/torrent';
import { Status } from '../rpc/transmission';
import * as Icon from "react-bootstrap-icons";
import { useForceRender } from '../util';
import { ConfigContext, ServerConfigContext } from '../config';

export interface TorrentFilter {
    id: string;
    filter: (t: Torrent) => boolean;
}

interface LabeledFilter {
    label: string;
    filter: (t: Torrent) => boolean;
}

const statusFilters: LabeledFilter[] = [
    { label: "All Torrents", filter: (t: Torrent) => true },
    { label: "Downloading", filter: (t: Torrent) => t.status == Status.downloading },
    {
        label: "Completed", filter: (t: Torrent) => {
            return t.status == Status.seeding || t.sizeWhenDone > 0 && t.leftUntilDone == 0;
        }
    },
    {
        label: "Active", filter: (t: Torrent) => {
            return t.rateDownload > 0 || t.rateUpload > 0;
        }
    },
    {
        label: "Inactive", filter: (t: Torrent) => {
            return t.rateDownload == 0 && t.rateUpload == 0 && t.status != Status.stopped;
        }
    },
    { label: "Stopped", filter: (t: Torrent) => t.status == Status.stopped },
    { label: "Error", filter: (t: Torrent) => (t.error != 0 || !!getTorrentError(t)) },
    {
        label: "Waiting", filter: (t: Torrent) => [
            Status.verifying,
            Status.queuedToVerify,
            Status.queuedToDownload].includes(t.status)
    },
]

const noLabelsFilter: LabeledFilter = {
    label: "<No labels>",
    filter: (t: Torrent) => t.labels.length == 0,
}

export const DefaultFilter = statusFilters[0].filter;

interface FiltersProps {
    torrents: Torrent[];
    allLabels: string[];
    currentFilter: TorrentFilter;
    setCurrentFilter: (filter: TorrentFilter) => void;
}

interface AllFilters {
    statusFilters: LabeledFilter[],
    labelFilters: LabeledFilter[],
}

function FilterRow(props: FiltersProps & { id: string, filter: LabeledFilter }) {
    var count = 0;

    for (var torrent of props.torrents) {
        if (props.filter.filter(torrent)) count++;
    }

    return <div
        className={`px-1 ${props.currentFilter.id === props.id ? ' bg-primary text-white' : ''}`}
        onClick={() => props.setCurrentFilter({ id: props.id, filter: props.filter.filter })}>
        {`${props.filter.label} (${count})`}
    </div>;
}

interface DirFilterRowProps extends FiltersProps {
    id: string,
    dir: Directory,
    forceRender: () => void,
}

function DirFilterRow(props: DirFilterRowProps) {
    const filter = useCallback((t: Torrent) => {
        var path = t.downloadDir as string;
        if (path.length + 1 == props.dir.path.length)
            return props.dir.path.startsWith(path);
        return path.startsWith(props.dir.path);
    }, []);

    const onExpand = useCallback(() => {
        props.dir.expanded = true;
        props.forceRender();
    }, [props.dir]);
    const onCollapse = useCallback(() => {
        props.dir.expanded = false;
        props.forceRender();
    }, [props.dir]);

    const expandable = props.dir.subdirs.size > 0;

    return (
        <div className="d-flex flex-row align-items-center"
            style={{ paddingLeft: `${props.dir.level * 1.4 + 0.25}em`, cursor: "default" }}>
            <div className="flex-shrink-0">
                {expandable ?
                    props.dir.expanded ?
                        <Icon.DashSquare size={16} onClick={onCollapse} style={{ cursor: "pointer" }} />
                        : <Icon.PlusSquare size={16} onClick={onExpand} style={{ cursor: "pointer" }} />
                    : <Icon.Folder size={16} />
                }
            </div>
            <div
                className={`ms-1 ps-1 flex-grow-1 ${props.currentFilter.id === props.id ? ' bg-primary text-white' : ''}`}
                onClick={() => props.setCurrentFilter({ id: props.id, filter })}>
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
}

function buildDirTree(paths: string[], oldtree: Directory | undefined, expanded: boolean): Directory {
    var root: Directory = { ...DefaultRoot, subdirs: new Map() };

    paths.forEach((path) => {
        var parts = path.split("/");
        var dir = root;
        var olddir = oldtree;
        var currentPath = "/";
        for (var part of parts) {
            if (part == "") continue;
            currentPath = currentPath + part + "/";
            if (!dir.subdirs.has(part))
                dir.subdirs.set(part, {
                    name: part,
                    path: currentPath,
                    subdirs: new Map(),
                    expanded,
                    count: 0,
                    level: dir.level + 1,
                });
            olddir = olddir?.subdirs.get(part);
            dir = dir.subdirs.get(part)!;
            if (olddir?.expanded) dir.expanded = true;
            dir.count++;
        }
    });

    return root;
}

function flattenTree(root: Directory): Directory[] {
    var result: Directory[] = [];
    const append = (dir: Directory) => {
        dir.subdirs.forEach((d) => {
            result.push(d);
            if (d.expanded) append(d);
        })
    }
    append(root);
    return result;
}

export function Filters(props: FiltersProps) {
    const serverConfig = useContext(ServerConfigContext);
    const forceRender = useForceRender();

    const defaultTree = useMemo(() => {
        return buildDirTree(serverConfig.expandedDirFilters, undefined, true)
    }, [serverConfig]);

    const [treeState,] = useState<{ tree: Directory }>({ tree: defaultTree });

    const paths = useMemo(
        () => props.torrents.map((t) => t.downloadDir as string).sort(),
        [props.torrents]);

    useMemo(() => {
        if (paths.length)
            treeState.tree = buildDirTree(paths, treeState.tree, false);
    }, [treeState, paths]);

    const dirs = flattenTree(treeState.tree!);

    var allFilters = useMemo<AllFilters>(() => {
        var labelFilters: LabeledFilter[] = [
            noLabelsFilter
        ];
        props.allLabels.forEach((label) => {
            labelFilters.push({
                label,
                filter: (t: Torrent) => t.labels.includes(label)
            });
        });
        return {
            statusFilters,
            labelFilters,
        };
    }, [props.allLabels]);

    useEffect(() => {
        return () => {
            serverConfig.expandedDirFilters = dirs.filter((d) => d.expanded).map((d) => d.path);
        }
    }, [dirs]);

    return (
        <div className='w-100 filter-container'>
            <div className="strike"><span>Status</span></div>
            {allFilters.statusFilters.map((f) =>
                <FilterRow key={`status-${f.label}`} id={`status-${f.label}`}
                    filter={f} {...props} />)}
            <div className="strike"><span>Directories</span></div>
            {paths.length > 0 ?
                dirs.map((d) =>
                    <DirFilterRow key={`dir-${d.path}`} id={`dir-${d.path}`}
                        dir={d} forceRender={forceRender} {...props} />
                ) : <></>
            }
            <div className="strike"><span>Labels</span></div>
            {allFilters.labelFilters.map((f) =>
                <FilterRow key={`labels-${f.label}`} id={`labels-${f.label}`}
                    filter={f} {...props} />)}
        </div>
    );
}
