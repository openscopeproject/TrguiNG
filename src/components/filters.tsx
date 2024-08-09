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

import React, { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Torrent } from "../rpc/torrent";
import { Status } from "../rpc/transmission";
import * as Icon from "react-bootstrap-icons";
import * as StatusIcons from "./statusicons";
import type { FilterSectionName, SectionsVisibility, StatusFilterName } from "../config";
import { ConfigContext, ServerConfigContext } from "../config";
import { Box, Button, Divider, Flex, Menu, Portal } from "@mantine/core";
import { eventHasModKey, useForceRender } from "trutil";
import { useContextMenu } from "./contextmenu";
import { MemoSectionsContextMenu, getSectionsMap } from "./sectionscontextmenu";

export interface TorrentFilter {
    id: string,
    filter: (t: Torrent) => boolean,
}

interface NamedFilter {
    name: string,
    filter: (t: Torrent) => boolean,
    icon: React.ComponentType,
}

interface StatusFilter extends NamedFilter {
    required?: boolean,
    name: StatusFilterName,
}

const statusFilters: StatusFilter[] = [
    {
        name: "All Torrents",
        filter: (t: Torrent) => true,
        icon: StatusIcons.All,
        required: true,
    },
    {
        name: "Downloading",
        filter: (t: Torrent) => t.status === Status.downloading,
        icon: StatusIcons.Downloading,
    },
    {
        name: "Completed",
        filter: (t: Torrent) => {
            return t.status === Status.seeding ||
                (t.sizeWhenDone > 0 && Math.max(t.sizeWhenDone - t.haveValid, 0) === 0);
        },
        icon: StatusIcons.Completed,
    },
    {
        name: "Active",
        filter: (t: Torrent) => {
            return t.rateDownload > 0 || t.rateUpload > 0;
        },
        icon: StatusIcons.Active,
    },
    {
        name: "Inactive",
        filter: (t: Torrent) => {
            return t.rateDownload === 0 && t.rateUpload === 0 && t.status !== Status.stopped;
        },
        icon: StatusIcons.Inactive,
    },
    {
        name: "Running",
        filter: (t: Torrent) => t.status !== Status.stopped,
        icon: StatusIcons.Running,
    },
    {
        name: "Stopped",
        filter: (t: Torrent) => t.status === Status.stopped,
        icon: StatusIcons.Stopped,
    },
    {
        name: "Error",
        filter: (t: Torrent) => (t.error !== 0 || t.cachedError !== ""),
        icon: StatusIcons.Error,
    },
    {
        name: "Waiting",
        filter: (t: Torrent) => [
            Status.verifying,
            Status.queuedToVerify,
            Status.queuedToDownload].includes(t.status),
        icon: StatusIcons.Waiting,
    },
    {
        name: "Magnetizing",
        filter: (t: Torrent) => t.status === Status.downloading && t.pieceCount === 0,
        icon: StatusIcons.Magnetizing,
    },
];

const noLabelsFilter: NamedFilter = {
    name: "<No labels>",
    filter: (t: Torrent) => t.labels?.length === 0,
    icon: StatusIcons.Label,
};

export const DefaultFilter = statusFilters[0].filter;

interface WithCurrentFilters {
    currentFilters: TorrentFilter[],
    setCurrentFilters: React.Dispatch<{
        verb: "set" | "toggle",
        filter: TorrentFilter,
    }>,
}

interface FiltersProps extends WithCurrentFilters {
    torrents: Torrent[],
}

interface FilterRowProps extends WithCurrentFilters {
    id: string,
    filter: NamedFilter,
    count: number,
}

function focusNextFilter(element: HTMLElement, next: boolean) {
    let nextElement: HTMLElement | null | undefined;
    const parent = element.parentElement as HTMLElement;
    const order = parseInt(parent.style.order);
    if (next) {
        if (element.nextElementSibling?.hasAttribute("tabIndex") === true) {
            nextElement = element.nextElementSibling as HTMLElement;
        } else {
            for (const node of parent.parentElement?.children ?? []) {
                if (parseInt((node as HTMLElement).style.order) === order + 1) {
                    nextElement = node.firstElementChild?.nextElementSibling as HTMLElement | null | undefined;
                }
            }
        }
    } else {
        if (element.previousElementSibling?.hasAttribute("tabIndex") === true) {
            nextElement = element.previousElementSibling as HTMLElement;
        } else {
            for (const node of parent.parentElement?.children ?? []) {
                if (parseInt((node as HTMLElement).style.order) === order - 1) {
                    nextElement = node.lastElementChild as HTMLElement | null | undefined;
                }
            }
        }
    }

    if (nextElement !== undefined && nextElement != null) {
        nextElement.focus();
        nextElement.click?.();
    }
}

function filterOnKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown") {
        event.stopPropagation();
        event.preventDefault();
        focusNextFilter(event.currentTarget, true);
    }
    if (event.key === "ArrowUp") {
        event.stopPropagation();
        event.preventDefault();
        focusNextFilter(event.currentTarget, false);
    }
}

const FilterRow = React.memo(function FilterRow(props: FilterRowProps) {
    return <Flex align="center" gap="sm" px="xs" tabIndex={-1}
        className={props.currentFilters.find((f) => f.id === props.id) !== undefined ? "selected" : ""}
        onClick={(event) => {
            props.setCurrentFilters({
                verb: eventHasModKey(event) ? "toggle" : "set",
                filter: { id: props.id, filter: props.filter.filter },
            });
        }}
        onKeyDown={filterOnKeyDown}>
        <div className="icon-container"><props.filter.icon /></div>
        <div style={{ flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{props.filter.name}</div>
        <div style={{ flexShrink: 0 }}>{`(${props.count})`}</div>
    </Flex>;
});

const LabelFilterRow = React.memo(function LabelFilterRow(props: Omit<FilterRowProps, "filter" | "id"> & { label: string }) {
    return <FilterRow {...props} id={`label-${props.label}`} filter={{
        name: props.label,
        filter: (t: Torrent) => t.labels.includes(props.label),
        icon: StatusIcons.Label,
    }} />;
});

const TrackerFilterRow = React.memo(function TrackerFilterRow(props: Omit<FilterRowProps, "filter" | "id"> & { tracker: string }) {
    return <FilterRow {...props} id={`tracker-${props.tracker}`} filter={{
        name: props.tracker,
        filter: (t: Torrent) => t.cachedMainTracker === props.tracker,
        icon: StatusIcons.Tracker,
    }} />;
});

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

    const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        if (expandable && !props.dir.expanded && event.key === "ArrowRight") {
            props.dir.expanded = true;
            props.expandedReducer({ verb: "add", value: props.dir.path });
        } else if (expandable && props.dir.expanded && event.key === "ArrowLeft") {
            props.dir.expanded = false;
            props.expandedReducer({ verb: "remove", value: props.dir.path });
        } else {
            filterOnKeyDown(event);
        }
    }, [expandable, props]);

    return (
        <Flex align="center" gap="sm" tabIndex={-1}
            style={{ paddingLeft: `${props.dir.level * 1.4 + 0.25}em`, cursor: "default" }}
            className={props.currentFilters.find((f) => f.id === props.id) !== undefined ? "selected" : ""}
            onClick={(event) => {
                props.setCurrentFilters({
                    verb: eventHasModKey(event) ? "toggle" : "set",
                    filter: { id: props.id, filter },
                });
            }}
            onKeyDown={onKeyDown}>
            <div className="icon-container">
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

function buildDirTree(paths: string[], expanded: string[], compactDirectories: boolean): Directory {
    const root: Directory = { ...DefaultRoot, subdirs: new Map() };

    paths.forEach((path) => {
        const parts = path.split("/");
        let dir = root;
        let currentPath = "";
        for (const part of parts) {
            currentPath = currentPath + part + "/";
            if (part === "") continue;
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

    return compactDirectories ? compactDirectoriesTree(root) : root;
}

function compactDirectoriesTree(root: Directory): Directory {
    const result = squashSingleChildDirectory(root);

    for (const [key, dir] of result.subdirs) {
        dir.level = result.level + 1;
        const condensedDir = compactDirectoriesTree(dir);
        result.subdirs.set(key, condensedDir);
    }

    return result;
}

function squashSingleChildDirectory(root: Directory): Directory {
    let result = root;

    if (root.subdirs.size === 1) {
        const [child] = root.subdirs.values();
        if (root.count === child.count) {
            child.name = root.name + "/" + child.name;
            child.level = root.level;
            result = squashSingleChildDirectory(child);
        }
    }

    return result;
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

export const Filters = React.memo(function Filters({ torrents, currentFilters, setCurrentFilters }: FiltersProps) {
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
        () => torrents.map((t) => t.downloadDir as string).sort(),
        [torrents]);

    const dirs = useMemo<Directory[]>(() => {
        const tree = buildDirTree(paths, serverConfig.expandedDirFilters, config.values.interface.compactDirectories);
        return flattenTree(tree);
    }, [paths, serverConfig.expandedDirFilters, config.values.interface.compactDirectories]);

    const [labels, trackers] = useMemo(() => {
        const labels: Record<string, number> = {};
        const trackers: Record<string, number> = {};
        config.values.interface.preconfiguredLabels.forEach((label) => { labels[label] = 0; });

        torrents.forEach((t) => t.labels?.forEach((l: string) => {
            if (!(l in labels)) labels[l] = 0;
            labels[l] = labels[l] + 1;
        }));

        torrents.forEach((t) => {
            if (!(t.cachedMainTracker in trackers)) trackers[t.cachedMainTracker] = 0;
            trackers[t.cachedMainTracker] = trackers[t.cachedMainTracker] + 1;
        });

        return [labels, trackers];
    }, [config, torrents]);

    const [sections, setSections] = useReducer(
        (_: SectionsVisibility<FilterSectionName>, sections: SectionsVisibility<FilterSectionName>) => {
            setCurrentFilters({ verb: "set", filter: { id: "", filter: DefaultFilter } });
            return sections;
        }, config.values.interface.filterSections);
    const [sectionsMap, setSectionsMap] = useState(getSectionsMap(sections));
    const [statusFiltersVisibility, setStatusFiltersVisibility] = useState(config.values.interface.statusFiltersVisibility);
    const [compactDirectories, setCompactDirectories] = useState(config.values.interface.compactDirectories);

    useEffect(() => {
        config.values.interface.filterSections = sections;
        config.values.interface.statusFiltersVisibility = statusFiltersVisibility;
        config.values.interface.compactDirectories = compactDirectories;
        setSectionsMap(getSectionsMap(sections));
    }, [config, sections, statusFiltersVisibility, compactDirectories]);

    const [info, setInfo, handler] = useContextMenu();

    const statusFiltersItemRef = useRef<HTMLButtonElement>(null);
    const contextMenuContainerRef = useRef<HTMLDivElement | null>(null) as React.MutableRefObject<HTMLDivElement>;
    const [statusFiltersSubmenuOpened, setStatusFiltersSubmenuOpened] = useState(false);
    const [statusFiltersItemRect, setStatusFiltersItemRect] = useState<DOMRect>(() => new DOMRect(0, -1000, 0, 0));

    const openStatusFiltersSubmenu = useCallback(() => {
        if (contextMenuContainerRef.current == null || statusFiltersItemRef.current == null) return;
        const dropdownRect = contextMenuContainerRef.current.querySelector(".mantine-Menu-dropdown")?.getBoundingClientRect();
        if (dropdownRect == null) return;
        const itemRect = statusFiltersItemRef.current.getBoundingClientRect();
        setStatusFiltersItemRect(new DOMRect(dropdownRect.x, itemRect.y, dropdownRect.width, itemRect.height));
        setStatusFiltersSubmenuOpened(true);
    }, []);

    const closeStatusFiltersSubmenu = useCallback(() => {
        setStatusFiltersSubmenuOpened(false);
        setStatusFiltersItemRect(new DOMRect(0, -1000, 0, 0));
    }, []);

    const onStatusFiltersSubmenuItemClick = useCallback((index: number) => {
        const filterName = statusFilters[index].name;
        const filterId = `status-${filterName}`;
        const newStatusFiltersVisibility = { ...statusFiltersVisibility };
        newStatusFiltersVisibility[filterName] = !statusFiltersVisibility[filterName];
        setStatusFiltersVisibility(newStatusFiltersVisibility);
        const selectedFilter = currentFilters.find(f => f.id === filterId);
        if (selectedFilter != null) {
            setCurrentFilters({ verb: "toggle", filter: selectedFilter });
        }
    }, [statusFiltersVisibility, currentFilters, setCurrentFilters]);

    const onCompactDirectoriesClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setCompactDirectories(!compactDirectories);
    }, [compactDirectories]);

    return (<>
        <Menu
            openDelay={100}
            closeDelay={400}
            opened={statusFiltersSubmenuOpened}
            onChange={setStatusFiltersSubmenuOpened}
            middlewares={{ shift: true, flip: true }}
            position="right-start"
            zIndex={301}
            offset={0}
            closeOnItemClick={false}
        >
            <Portal>
                <Box
                    onMouseDown={closeStatusFiltersSubmenu}
                    sx={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: "100vh",
                        width: "100vw",
                        zIndex: statusFiltersSubmenuOpened ? 100 : -1,
                    }} />
                <Menu.Target>
                    <Button unstyled
                        sx={{
                            position: "absolute",
                            border: 0,
                            padding: 0,
                            background: "transparent",
                        }}
                        style={{
                            left: statusFiltersItemRect.x,
                            top: statusFiltersItemRect.y,
                            width: statusFiltersItemRect.width,
                            height: statusFiltersItemRect.height,
                        }} />
                </Menu.Target>
                <Menu.Dropdown miw="10rem">
                    {statusFilters.map((f, index) =>
                        f.required !== true &&
                        <Menu.Item
                            key={f.name}
                            onClick={() => { onStatusFiltersSubmenuItemClick(index); }}
                            icon={statusFiltersVisibility[f.name] ? <Icon.Check size="1rem" /> : <Box miw="1rem" />}
                        >
                            {f.name}
                        </Menu.Item>)}
                </Menu.Dropdown>
            </Portal>
        </Menu>
        <Flex direction="column" onContextMenu={handler}
            sx={{
                width: "100%",
                minHeight: "100%",
                whiteSpace: "nowrap",
                cursor: "default",
                userSelect: "none",
            }}>
            <MemoSectionsContextMenu
                sections={sections} setSections={setSections}
                contextMenuInfo={info} setContextMenuInfo={setInfo}
                contextMenuContainerRef={contextMenuContainerRef}
                onSectionItemMouseEnter={closeStatusFiltersSubmenu}
                closeOnClickOutside={!statusFiltersSubmenuOpened}
            >
                <Menu.Divider />
                <Menu.Item
                    ref={statusFiltersItemRef}
                    icon={<Box miw="1rem" />}
                    rightSection={<Icon.ChevronRight size="12" style={{ marginRight: "-0.4rem" }} />}
                    onMouseEnter={openStatusFiltersSubmenu}
                    onMouseDown={(e) => { e.stopPropagation(); }}
                >
                    Status filters
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                    icon={compactDirectories ? <Icon.Check size="1rem" /> : <Box miw="1rem" />}
                    onMouseEnter={closeStatusFiltersSubmenu}
                    onMouseDown={onCompactDirectoriesClick}
                >
                    Compact Directories
                </Menu.Item>
            </MemoSectionsContextMenu>
            {sections[sectionsMap.Status].visible && <div style={{ order: sectionsMap.Status }}>
                <Divider mx="sm" label="Status" labelPosition="center" />
                {statusFilters.map((f) =>
                    (f.required === true || statusFiltersVisibility[f.name]) && <FilterRow key={`status-${f.name}`}
                        id={`status-${f.name}`} filter={f}
                        count={torrents.filter(f.filter).length}
                        currentFilters={currentFilters} setCurrentFilters={setCurrentFilters} />)}
            </div>}
            {sections[sectionsMap.Directories].visible && <div style={{ order: sectionsMap.Directories }}>
                <Divider mx="sm" mt="md" label="Directories" labelPosition="center" />
                {dirs.map((d) =>
                    <DirFilterRow key={`dir-${d.path}`} id={`dir-${d.path}`}
                        dir={d} expandedReducer={expandedReducer} {...{ torrents, currentFilters, setCurrentFilters }} />)}
            </div>}
            {sections[sectionsMap.Labels].visible && <div style={{ order: sectionsMap.Labels }}>
                <Divider mx="sm" mt="md" label="Labels" labelPosition="center" />
                <FilterRow
                    id="nolabels" filter={noLabelsFilter}
                    count={torrents.filter(noLabelsFilter.filter).length}
                    currentFilters={currentFilters} setCurrentFilters={setCurrentFilters} />
                {Object.keys(labels).sort().map((label) =>
                    <LabelFilterRow key={`labels-${label}`} label={label}
                        count={labels[label]}
                        currentFilters={currentFilters} setCurrentFilters={setCurrentFilters} />)}
            </div>}
            {sections[sectionsMap.Trackers].visible && <div style={{ order: sectionsMap.Trackers }}>
                <Divider mx="sm" mt="md" label="Trackers" labelPosition="center" />
                {Object.keys(trackers).sort().map((tracker) =>
                    <TrackerFilterRow key={`trackers-${tracker}`} tracker={tracker}
                        count={trackers[tracker]}
                        currentFilters={currentFilters} setCurrentFilters={setCurrentFilters} />)}
            </div>}
        </Flex>
    </>);
});
