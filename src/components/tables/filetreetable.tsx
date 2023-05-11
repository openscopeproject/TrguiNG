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

import React, { useCallback, useContext, useMemo } from "react";
import { type Row, type ColumnDef, type CellContext } from "@tanstack/react-table";
import { type CachedFileTree, type DirEntry, type FileDirEntry, isDirEntry } from "../../cachedfiletree";
import { ServerConfigContext } from "../../config";
import { PriorityColors, PriorityStrings } from "../../rpc/transmission";
import { bytesToHumanReadableStr, pathMapFromServer } from "../../util";
import { ProgressBar } from "../progressbar";
import * as Icon from "react-bootstrap-icons";
import { tauri } from "@tauri-apps/api";
import { TransguiTable } from "./common";
import { Badge, Box, Checkbox, Flex, Loader, useMantineTheme } from "@mantine/core";
import { refreshFileTree } from "queries";

type FileDirEntryKey = keyof FileDirEntry;
type EntryWantedChangeHandler = (entry: FileDirEntry, state: boolean) => void;

interface TableFieldProps {
    fileTree: CachedFileTree,
    entry: FileDirEntry,
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
    const isDir = isDirEntry(props.entry);
    const onExpand = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDirEntry(props.entry)) props.fileTree.expand(props.entry.fullpath, true);
        refreshFileTree(props.treeName);
    }, [props]);
    const onCollapse = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDirEntry(props.entry)) props.fileTree.expand(props.entry.fullpath, false);
        refreshFileTree(props.treeName);
    }, [props]);

    const theme = useMantineTheme();

    return (
        <Flex wrap="nowrap" gap="0.3rem" align="flex-end" sx={{ paddingLeft: `${props.entry.level * 2}em`, cursor: "default" }}>
            <Box w="1.4rem" mx="auto">
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
            <Box>
                {isDir
                    ? (props.entry as DirEntry).expanded
                        ? <Icon.DashSquare size={16} onClick={onCollapse} style={{ cursor: "pointer" }} />
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
    }, [props]);

    return <>{stringValue}</>;
}

function PercentBarField(props: TableFieldProps) {
    const now = props.entry.percent ?? 0;

    return <ProgressBar now={now} className="white-outline" />;
}

function PriorityField(props: TableFieldProps) {
    const priority = props.entry.priority ?? 0;
    return <Badge
        radius="md"
        variant="filled"
        bg={PriorityColors.get(priority)}>
        {PriorityStrings.get(priority)}
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

export function FileTreeTable(props: FileTreeTableProps) {
    const serverConfig = useContext(ServerConfigContext);
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
        .filter((field) => field.briefField === true || props.brief !== true)
        .map((field): ColumnDef<FileDirEntry> => {
            const cell = (cellProps: CellContext<FileDirEntry, unknown>) => {
                return <field.component
                    fileTree={props.fileTree}
                    fieldName={field.name}
                    entry={cellProps.row.original}
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

    const selected = useMemo(() => props.data.filter((e) => e.isSelected).map(getRowId), [props.data, getRowId]);

    const selectedReducer = useCallback((action: { verb: "add" | "set", ids: string[] }) => {
        props.fileTree.selectAction(action);
        refreshFileTree(props.brief === true ? "filetreebrief" : "filetree");
    }, [props.fileTree, props.brief]);

    const onRowDoubleClick = useCallback((row: FileDirEntry) => {
        if (props.downloadDir === undefined || props.downloadDir === "") return;
        let path = `${props.downloadDir}/${row.originalpath}`;
        path = pathMapFromServer(path, serverConfig);
        tauri.invoke("shell_open", { path }).catch((e) => { console.error("Error opening", path, e); });
    }, [props.downloadDir, serverConfig]);

    return <TransguiTable<FileDirEntry> {...{
        tablename: props.brief === true ? "filetreebrief" : "filetree",
        columns,
        data: props.data,
        selected,
        getRowId,
        selectedReducer,
        onRowDoubleClick,
    }} />;
}
