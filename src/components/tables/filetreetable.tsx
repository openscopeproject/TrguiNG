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

import React, { useCallback, useContext, useMemo, useReducer } from "react";
import { Row, ColumnDef, CellContext } from '@tanstack/react-table';
import { CachedFileTree, DirEntry, FileDirEntry, isDirEntry } from "../../cachedfiletree";
import { ServerConfigContext } from "../../config";
import { PriorityColors, PriorityStrings } from "../../rpc/transmission";
import { bytesToHumanReadableStr, pathMapFromServer } from "../../util";
import { ProgressBar } from "../progressbar";
import * as Icon from "react-bootstrap-icons";
import { Torrent } from "../../rpc/torrent";
import { invoke } from '@tauri-apps/api/tauri'
import { Table } from "./common";
import { Badge } from "@mantine/core";


type FileDirEntryKey = keyof FileDirEntry;

interface TableFieldProps {
    entry: FileDirEntry,
    fieldName: FileDirEntryKey,
    forceRender: () => void,
}

interface TableField {
    name: FileDirEntryKey,
    label: string,
    component: React.FunctionComponent<TableFieldProps>,
}

const AllFields: readonly TableField[] = [
    { name: "name", label: "Name", component: NameField },
    { name: "size", label: "Size", component: ByteSizeField },
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
        <div style={{ paddingLeft: `${props.entry.level * 2}em`, cursor: "default" }}>
            <input type="checkbox" checked={props.entry.want} className={"me-2"} readOnly />
            {isDir ?
                (props.entry as DirEntry).expanded ?
                    <Icon.DashSquare size={16} onClick={onCollapse} style={{ cursor: "pointer" }} />
                    : <Icon.PlusSquare size={16} onClick={onExpand} style={{ cursor: "pointer" }} />
                : <Icon.FileEarmark size={16} />
            }
            <span className="ms-2">{props.entry.name}</span>
        </div>
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

export function FileTreeTable(props: { torrent: Torrent }) {
    const serverConfig = useContext(ServerConfigContext);
    const [renderVal, forceRender] = useReducer((oldVal) => oldVal + 1, 0);

    const fileTree = useMemo(() => new CachedFileTree(), []);

    useMemo(() => fileTree.update(props.torrent), [props.torrent]);

    const nameSortFunc = useCallback(
        (rowa: Row<FileDirEntry>, rowb: Row<FileDirEntry>) => {
            const [a, b] = [rowa.original, rowb.original];
            // if (isDirEntry(a) && !isDirEntry(b))
            //     return -1;
            // if (!isDirEntry(a) && isDirEntry(b))
            //     return 1;
            return a.fullpath < b.fullpath ? -1 : 1;
        }, []);

    const columns = useMemo(() => {
        return AllFields.map((field): ColumnDef<FileDirEntry> => {
            const cell = (props: CellContext<FileDirEntry, unknown>) => {
                return <field.component
                    fieldName={field.name}
                    entry={props.row.original}
                    forceRender={forceRender} />
            }
            var column: ColumnDef<FileDirEntry> = {
                header: field.label,
                accessorKey: field.name,
                cell,
            }
            if (field.name == "name") column.sortingFn = nameSortFunc;
            return column;
        });
    }, [forceRender]);

    const data = useMemo(() => fileTree.flatten(), [renderVal, props.torrent]);

    const getRowId = useCallback((row: FileDirEntry) => row.fullpath, []);

    const selectedReducer = useCallback((action: { verb: "add" | "set", ids: string[] }) => {
        fileTree.selectAction(action);
        forceRender();
     }, [fileTree, forceRender]);

    const onRowDoubleClick = useCallback((row: FileDirEntry) => {
        let path = `${props.torrent.downloadDir}/${row.originalpath}`;
        path = pathMapFromServer(path, serverConfig);
        invoke('shell_open', { path }).catch((e) => console.error("Error opening", path, e));
    }, [props.torrent]);

    return <Table<FileDirEntry> {...{
        tablename: "filetree",
        columns,
        data,
        getRowId,
        selectedReducer,
        onRowDoubleClick,
    }} />;
}
