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

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Row, ColumnDef, CellContext } from "@tanstack/react-table";
import type { CachedFileTree, FileDirEntry } from "../../cachedfiletree";
import { isDirEntry } from "../../cachedfiletree";
import { ServerConfigContext } from "../../config";
import { PriorityColors, PriorityStrings } from "../../rpc/transmission";
import { bytesToHumanReadableStr, pathMapFromServer } from "../../trutil";
import { ProgressBar } from "../progressbar";
import * as Icon from "react-bootstrap-icons";
import type { TrguiTableRef } from "./common";
import { EditableNameField, TrguiTable } from "./common";
import { Badge, Box, Checkbox, Loader, Menu, Text, useMantineTheme } from "@mantine/core";
import { refreshFileTree, useMutateTorrent, useMutateTorrentPath } from "queries";
import { notifications } from "@mantine/notifications";
import type { ContextMenuInfo } from "components/contextmenu";
import { ContextMenu, useContextMenu } from "components/contextmenu";
import { useHotkeysContext } from "hotkeys";
const { TAURI, invoke } = await import(/* webpackChunkName: "taurishim" */"taurishim");

type FileDirEntryKey = keyof FileDirEntry;
type EntryWantedChangeHandler = (entry: FileDirEntry, state: boolean) => void;

interface TableFieldProps {
    fileTree: CachedFileTree,
    entry: FileDirEntry,
    row: Row<FileDirEntry>,
    fieldName: FileDirEntryKey,
    treeName: string,
    onCheckboxChange: EntryWantedChangeHandler,
}

interface TableField {
    name: FileDirEntryKey,
    label: string,
    component: React.FunctionComponent<TableFieldProps>,
    briefField?: boolean,
}

const AllFields: readonly TableField[] = [
    { name: "name", label: "Name", component: NameField, briefField: true },
    { name: "size", label: "Size", component: ByteSizeField, briefField: true },
    { name: "done", label: "Done", component: ByteSizeField },
    { name: "percent", label: "Percent", component: PercentBarField },
    { name: "priority", label: "Priority", component: PriorityField },
] as const;

function NameField(props: TableFieldProps) {
    const { entry, fileTree } = props;
    const isDir = isDirEntry(entry);

    const onToggleExpand = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        props.row.toggleExpanded();
    }, [props]);

    const theme = useMantineTheme();

    const mutation = useMutateTorrentPath();

    const updatePath = useCallback((name: string, onStart: () => void, onEnd: () => void) => {
        onStart();

        mutation.mutate(
            { torrentId: fileTree.torrentId, path: props.entry.fullpath, name },
            {
                onSettled: onEnd,
                onError: () => { notifications.show({ color: "red", message: "Failed to update file path" }); },
                onSuccess: () => {
                    fileTree.updatePath(props.entry.fullpath, name);
                    refreshFileTree(props.treeName);
                },
            });
    }, [mutation, fileTree, props.entry.fullpath, props.treeName]);

    return (
        <EditableNameField currentName={props.entry.name} onUpdate={props.treeName === "filetree" ? updatePath : undefined}>
            <Box sx={{ width: `${props.entry.level * 1.6}rem`, flexShrink: 0 }} />
            <Box w="1.4rem" mx="auto" sx={{ flexShrink: 0 }}>
                {props.entry.wantedUpdating
                    ? <Loader size="1.2rem" color={theme.colorScheme === "dark" ? theme.colors.cyan[4] : theme.colors.cyan[9]} />
                    : <Checkbox
                        checked={props.entry.want === true || props.entry.want === undefined}
                        indeterminate={props.entry.want === undefined}
                        onChange={(e) => {
                            props.onCheckboxChange(props.entry, e.currentTarget.checked);
                            refreshFileTree(props.treeName);
                        }}
                        onClick={(e) => { e.stopPropagation(); }}
                        onDoubleClick={(e) => { e.stopPropagation(); }} />
                }
            </Box>
            <Box ml="xs" sx={{ flexShrink: 0, height: "100%" }}>
                {isDir
                    ? props.row.getIsExpanded()
                        ? <Icon.DashSquare size="1.1rem" onClick={onToggleExpand} style={{ cursor: "pointer" }} />
                        : <Icon.PlusSquare size="1.1rem" onClick={onToggleExpand} style={{ cursor: "pointer" }} />
                    : <Icon.FileEarmark size="1.1rem" />
                }
            </Box>
        </EditableNameField>
    );
}

function ByteSizeField(props: TableFieldProps) {
    const stringValue = useMemo(() => {
        return bytesToHumanReadableStr(props.entry[props.fieldName] as number);
    }, [props]);

    return <div>{stringValue}</div>;
}

function PercentBarField(props: TableFieldProps) {
    const now = props.entry.percent ?? 0;

    return <ProgressBar now={now} className="white-outline" />;
}

function PriorityField(props: TableFieldProps) {
    const priority = props.entry.priority;
    return <Badge
        radius="md"
        variant="filled"
        bg={priority === undefined ? "gray" : PriorityColors.get(priority)}>
        {priority === undefined ? "mixed" : PriorityStrings.get(priority)}
    </Badge>;
}

interface FileTreeTableProps {
    fileTree: CachedFileTree,
    data: FileDirEntry[],
    onCheckboxChange: EntryWantedChangeHandler,
    downloadDir?: string,
    brief?: boolean,
}

export function useUnwantedFiles(ft: CachedFileTree, setUpdating: boolean): EntryWantedChangeHandler {
    const changeHandler = useCallback((entry: FileDirEntry, state: boolean) => {
        ft.setWanted(entry.fullpath, state, setUpdating);
    }, [ft, setUpdating]);

    return changeHandler;
}

function useSelected(props: FileTreeTableProps) {
    const [selected, setSelected] = useState<string[]>([]);

    const selectAll = useRef(() => { });
    const hk = useHotkeysContext();

    selectAll.current = useCallback(() => {
        const ids = props.data.map((entry) => entry.fullpath);
        props.fileTree.selectAction({ verb: "set", ids });
        setSelected(props.fileTree.getSelected());
    }, [props.data, props.fileTree]);

    useEffect(() => {
        return () => { hk.handlers.selectAll = () => { }; };
    }, [hk]);

    const selectedReducer = useCallback((action: { verb: "add" | "set" | "toggle", ids: string[], isReset?: boolean }) => {
        props.fileTree.selectAction(action);
        setSelected(props.fileTree.getSelected());
        if (action.isReset !== true) {
            hk.handlers.selectAll = () => { selectAll.current?.(); };
        }
    }, [props.fileTree, hk]);

    return { selected, selectedReducer };
}

export function FileTreeTable(props: FileTreeTableProps) {
    const serverConfig = useContext(ServerConfigContext);
    const onCheckboxChange = props.onCheckboxChange;

    const nameSortFunc = useCallback(
        (rowa: Row<FileDirEntry>, rowb: Row<FileDirEntry>) => {
            const [a, b] = [rowa.original, rowb.original];
            return a.fullpath < b.fullpath ? -1 : 1;
        }, []);

    const columns = useMemo(() => AllFields
        .filter((field) => field.briefField === true || props.brief !== true)
        .map((field): ColumnDef<FileDirEntry> => {
            const cell = (cellProps: CellContext<FileDirEntry, unknown>) => {
                return <field.component
                    fileTree={props.fileTree}
                    fieldName={field.name}
                    entry={cellProps.row.original}
                    row={cellProps.row}
                    treeName={props.brief === true ? "filetreebrief" : "filetree"}
                    onCheckboxChange={onCheckboxChange} />;
            };
            const column: ColumnDef<FileDirEntry> = {
                header: field.label,
                accessorKey: field.name,
                cell,
            };
            if (field.name === "name") column.sortingFn = nameSortFunc;
            return column;
        }), [props.brief, props.fileTree, nameSortFunc, onCheckboxChange]);

    const getRowId = useCallback((row: FileDirEntry) => row.fullpath, []);
    const getSubRows = useCallback((row: FileDirEntry) => {
        if (isDirEntry(row)) {
            return row.subrows;
        }
        return [];
    }, []);

    const { selected, selectedReducer } = useSelected(props);

    useEffect(() => {
        selectedReducer({ verb: "set", ids: [], isReset: true });
    }, [props.fileTree.torrenthash, selectedReducer]);

    const onRowDoubleClick = useCallback((row: FileDirEntry) => {
        if (TAURI) {
            if (props.downloadDir === undefined || props.downloadDir === "") return;
            let path = `${props.downloadDir}/${row.fullpath}`;
            path = pathMapFromServer(path, serverConfig);
            invoke("shell_open", { path }).catch((e) => {
                notifications.show({
                    title: "Error opening path",
                    message: path,
                    color: "red",
                });
            });
        }
    }, [props.downloadDir, serverConfig]);

    const [info, setInfo, handler] = useContextMenu();

    const tableRef = useRef<TrguiTableRef>();

    return (
        <Box w="100%" h="100%" onContextMenu={handler}>
            {props.brief === true
                ? <></>
                : <FiletreeContextMenu
                    contextMenuInfo={info}
                    setContextMenuInfo={setInfo}
                    fileTree={props.fileTree}
                    selected={selected}
                    onRowDoubleClick={onRowDoubleClick}
                    setExpanded={tableRef.current?.setExpanded} />}
            <TrguiTable<FileDirEntry> {...{
                tablename: props.brief === true ? "filetreebrief" : "filetree",
                tableRef,
                columns,
                data: props.data,
                selected,
                getRowId,
                getSubRows,
                selectedReducer,
                onRowDoubleClick,
            }} />
        </Box>
    );
}

function FiletreeContextMenu(props: {
    contextMenuInfo: ContextMenuInfo,
    setContextMenuInfo: (i: ContextMenuInfo) => void,
    fileTree: CachedFileTree,
    selected: string[],
    onRowDoubleClick: (row: FileDirEntry) => void,
    setExpanded?: (state: boolean) => void,
}) {
    const { onRowDoubleClick } = props;
    const onOpen = useCallback(() => {
        const [path] = [...props.selected];
        const entry = props.fileTree.findEntry(path);
        if (entry === undefined) return;
        onRowDoubleClick(entry);
    }, [onRowDoubleClick, props.fileTree, props.selected]);

    const mutation = useMutateTorrent();

    const setPriority = useCallback((priority: "priority-high" | "priority-normal" | "priority-low") => {
        const fileIds = Array.from(props.selected
            .map((path) => props.fileTree.getChildFilesIndexes(path))
            .reduce((set, curIds) => {
                curIds.forEach((id) => set.add(id));
                return set;
            }, new Set<number>()));

        mutation.mutate(
            {
                torrentIds: [props.fileTree.torrentId],
                fields: {
                    [priority]: fileIds,
                },
            },
            {
                onSuccess: () => {
                    notifications.show({
                        message: "Priority updated",
                        color: "green",
                    });
                },
            },
        );
    }, [mutation, props.fileTree, props.selected]);

    const setWanted = useCallback((wanted: boolean) => {
        const fileIds = Array.from(props.selected
            .map((path) => props.fileTree.getChildFilesIndexes(path))
            .reduce((set, curIds) => {
                curIds.forEach((id) => set.add(id));
                return set;
            }, new Set<number>()));

        mutation.mutate(
            {
                torrentIds: [props.fileTree.torrentId],
                fields: {
                    [wanted ? "files-wanted" : "files-unwanted"]: fileIds,
                },
            },
            {
                onSuccess: () => {
                    notifications.show({
                        message: "Files updated",
                        color: "green",
                    });
                },
            },
        );
    }, [mutation, props.fileTree, props.selected]);

    return (
        <ContextMenu contextMenuInfo={props.contextMenuInfo} setContextMenuInfo={props.setContextMenuInfo}>
            {TAURI && <>
                <Menu.Item
                    onClick={onOpen}
                    icon={<Icon.BoxArrowUpRight size="1.1rem" />}
                    disabled={props.selected.length !== 1}>
                    <Text weight="bold">Open</Text>
                </Menu.Item>
                <Menu.Divider />
            </>}
            <Menu.Item
                onClick={() => { setPriority("priority-high"); }}
                icon={<Icon.CircleFill color="tomato" size="1.1rem" />}
                disabled={props.selected.length === 0}>
                High priority
            </Menu.Item>
            <Menu.Item
                onClick={() => { setPriority("priority-normal"); }}
                icon={<Icon.CircleFill color="seagreen" size="1.1rem" />}
                disabled={props.selected.length === 0}>
                Normal priority
            </Menu.Item>
            <Menu.Item
                onClick={() => { setPriority("priority-low"); }}
                icon={<Icon.CircleFill color="gold" size="1.1rem" />}
                disabled={props.selected.length === 0}>
                Low priority
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
                onClick={() => { setWanted(true); }}
                icon={<Checkbox checked readOnly />}
                disabled={props.selected.length === 0}>
                Set wanted
            </Menu.Item>
            <Menu.Item
                onClick={() => { setWanted(false); }}
                icon={<Checkbox readOnly />}
                disabled={props.selected.length === 0}>
                Set unwanted
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
                onClick={() => { props.setExpanded?.(true); }}
                icon={<Icon.PlusSquare size="1.1rem" />}>
                Expand all
            </Menu.Item>
            <Menu.Item
                onClick={() => { props.setExpanded?.(false); }}
                icon={<Icon.DashSquare size="1.1rem" />}>
                Collapse all
            </Menu.Item>
        </ContextMenu >
    );
}
