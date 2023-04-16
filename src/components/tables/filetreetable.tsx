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

import React, { useCallback, useContext, useMemo, useReducer, useState } from "react";
import { Row, ColumnDef, CellContext } from '@tanstack/react-table';
import { CachedFileTree, DirEntry, FileDirEntry, isDirEntry } from "../../cachedfiletree";
import { ServerConfigContext } from "../../config";
import { PriorityColors, PriorityStrings } from "../../rpc/transmission";
import { bytesToHumanReadableStr, pathMapFromServer } from "../../util";
import { ProgressBar } from "../progressbar";
import * as Icon from "react-bootstrap-icons";
import { tauri } from '@tauri-apps/api'
import { Table } from "./common";
import { Badge, Box, Checkbox, Flex } from "@mantine/core";


type FileDirEntryKey = keyof FileDirEntry;
type EntryWantedChangeHandler = (entry: FileDirEntry, state: boolean) => void;

interface TableFieldProps {
    entry: FileDirEntry,
    fieldName: FileDirEntryKey,
    forceRender: () => void,
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
    const isDir = isDirEntry(props.entry);
    const onExpand = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDirEntry(props.entry)) props.entry.expanded = true;
        props.forceRender();
    }, [props.entry]);
    const onCollapse = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDirEntry(props.entry)) props.entry.expanded = false;
        props.forceRender();
    }, [props.entry]);

    return (
        <Flex wrap="nowrap" gap="0.3rem" align="flex-end" sx={{ paddingLeft: `${props.entry.level * 2}em`, cursor: "default" }}>
            <Checkbox
                checked={props.entry.want || props.entry.want === undefined}
                indeterminate={props.entry.want === undefined}
                onChange={(e) => {
                    props.onCheckboxChange(props.entry, e.currentTarget.checked);
                    props.forceRender();
                }}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()} />
            <Box>
                {isDir ?
                    (props.entry as DirEntry).expanded ?
                        <Icon.DashSquare size={16} onClick={onCollapse} style={{ cursor: "pointer" }} />
                        : <Icon.PlusSquare size={16} onClick={onExpand} style={{ cursor: "pointer" }} />
                    : <Icon.FileEarmark size={16} />
                }
            </Box>
            <Box sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{props.entry.name}</Box>
        </Flex>
    );
}

function ByteSizeField(props: TableFieldProps) {
    const stringValue = useMemo(() => {
        return bytesToHumanReadableStr(props.entry[props.fieldName] as number);
    }, [props.entry[props.fieldName]]);

    return <>{stringValue}</>;
}

function PercentBarField(props: TableFieldProps) {
    const now = props.entry.percent || 0;

    return <ProgressBar now={now} className="white-outline" />
}

function PriorityField(props: TableFieldProps) {
    const priority = props.entry.priority || 0;
    return <Badge radius="md" variant="filled" bg={PriorityColors.get(priority)!}>{PriorityStrings.get(priority)}</Badge>;
}

interface FileTreeTableProps {
    fileTree: CachedFileTree,
    onCheckboxChange: EntryWantedChangeHandler,
    downloadDir?: string,
    brief?: boolean,
    renderVal?: number,
}

export function useUnwantedFiles(ft: CachedFileTree): EntryWantedChangeHandler {
    const changeHandler = useCallback((entry: FileDirEntry, state: boolean) => {
        ft.setWanted(entry, state);
    }, [ft]);

    return changeHandler;
}

export function FileTreeTable(props: FileTreeTableProps) {
    const serverConfig = useContext(ServerConfigContext);
    const [renderVal, forceRender] = useReducer((oldVal) => oldVal + 1, 0);
    const onCheckboxChange = props.onCheckboxChange;

    const nameSortFunc = useCallback(
        (rowa: Row<FileDirEntry>, rowb: Row<FileDirEntry>) => {
            const [a, b] = [rowa.original, rowb.original];
            // if (isDirEntry(a) && !isDirEntry(b))
            //     return -1;
            // if (!isDirEntry(a) && isDirEntry(b))
            //     return 1;
            return a.fullpath < b.fullpath ? -1 : 1;
        }, []);

    const columns = useMemo(() => AllFields
        .filter((field) => field.briefField || !props.brief)
        .map((field): ColumnDef<FileDirEntry> => {
            const cell = (props: CellContext<FileDirEntry, unknown>) => {
                return <field.component
                    fieldName={field.name}
                    entry={props.row.original}
                    forceRender={forceRender}
                    onCheckboxChange={onCheckboxChange} />
            }
            var column: ColumnDef<FileDirEntry> = {
                header: field.label,
                accessorKey: field.name,
                cell,
            }
            if (field.name == "name") column.sortingFn = nameSortFunc;
            return column;
        }), [forceRender, props.brief, onCheckboxChange]);

    const data = useMemo(() => props.fileTree.flatten(), [renderVal, props.renderVal, props.fileTree]);

    const getRowId = useCallback((row: FileDirEntry) => row.fullpath, []);

    const selectedReducer = useCallback((action: { verb: "add" | "set", ids: string[] }) => {
        props.fileTree.selectAction(action);
        forceRender();
    }, [props.fileTree, forceRender]);

    const onRowDoubleClick = useCallback((row: FileDirEntry) => {
        if (!props.downloadDir) return;
        let path = `${props.downloadDir}/${row.originalpath}`;
        path = pathMapFromServer(path, serverConfig);
        tauri.invoke('shell_open', { path }).catch((e) => console.error("Error opening", path, e));
    }, [props.downloadDir, serverConfig]);

    return <Table<FileDirEntry> {...{
        tablename: props.brief ? "filetreebrief" : "filetree",
        columns,
        data,
        getRowId,
        selectedReducer,
        onRowDoubleClick,
    }} />;
}
