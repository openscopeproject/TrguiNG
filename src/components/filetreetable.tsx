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

import React, { memo, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { Badge } from "react-bootstrap";
import { useReactTable, Row, ColumnSizingState, SortingState, VisibilityState, ColumnDef, getCoreRowModel, flexRender, CellContext, getSortedRowModel } from '@tanstack/react-table';
import { useVirtualizer } from "@tanstack/react-virtual";
import { CachedFileTree, DirEntry, FileDirEntry, isDirEntry } from "../cachedfiletree";
import { ConfigContext, PathMapping, ServerConfigContext } from "../config";
import { PriorityColors, PriorityStrings } from "../rpc/transmission";
import { bytesToHumanReadableStr } from "../util";
import { ProgressBar } from "./progressbar";
import * as Icon from "react-bootstrap-icons";
import { Torrent } from "../rpc/torrent";
import { invoke } from '@tauri-apps/api/tauri'


type FileDirEntryKey = keyof FileDirEntry;

interface TableFieldProps {
    entry: FileDirEntry,
    fieldName: FileDirEntryKey,
    forceRender: () => void,
}

interface TableField {
    name: "name" | "size" | "done" | "percent" | "priority",
    label: string,
    component: React.FunctionComponent<TableFieldProps>,
}

const BasicFields: readonly TableField[] = [
    { name: "name", label: "Name", component: NameField },
    { name: "size", label: "Size", component: ByteSizeField },
] as const;

const AllFields: readonly TableField[] = [
    ...BasicFields,
    { name: "done", label: "Done", component: ByteSizeField },
    { name: "percent", label: "Percent", component: PercentBarField },
    { name: "priority", label: "Priority", component: PriorityField },
] as const;

function NameField(props: TableFieldProps) {
    const isDir = isDirEntry(props.entry);
    const onExpand = useCallback(() => {
        if (isDirEntry(props.entry)) props.entry.expanded = true;
        props.forceRender();
    }, [props.entry]);
    const onCollapse = useCallback(() => {
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
    return <Badge pill bg={PriorityColors.get(priority)!}>{PriorityStrings.get(priority)}</Badge>;
}

const FileTableRow = memo(function FileTableRow(props: {
    torrent: Torrent,
    mappings: PathMapping[],
    row: Row<FileDirEntry>,
    index: number,
    start: number,
    lastIndex: number,
    rowClick: (e: React.MouseEvent<Element>, i: number, li: number) => void,
    height: number,
    columnSizingState: ColumnSizingState,
    columnVisibilityState: VisibilityState
}) {
    const doubleClickHandler = useCallback(() => {
        let path = `${props.torrent.downloadDir}/${props.torrent.name}/${props.row.original.fullpath}`;
        for (let mapping of props.mappings) {
            if (mapping.from.length > 0 && path.startsWith(mapping.from)) {
                path = mapping.to + path.substring(mapping.from.length);
            }
        }
        invoke('shell_open', {path}).catch(console.error);
    }, [props.torrent, props.mappings, props.row]);

    return (
        <div
            className={`tr ${props.index % 2 ? " odd" : ""}`}
            style={{ height: `${props.height}px`, transform: `translateY(${props.start}px)` }}
            onClick={(e) => {
                props.rowClick(e, props.index, props.lastIndex);
            }}
            onDoubleClick={doubleClickHandler}
        >
            {props.row.getVisibleCells().map(cell => {
                return (
                    <div {...{
                        key: cell.id,
                        style: {
                            width: cell.column.getSize(),
                        },
                        className: "td"
                    }} >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                )
            })}
        </div>
    );
});

export function FileTreeTable(props: { torrent: Torrent }) {
    const config = useContext(ConfigContext);
    const serverConfig = useContext(ServerConfigContext);
    const [renderVal, forceRender] = useReducer((oldVal) => oldVal + 1, 0);

    const fileTree = useMemo(() => new CachedFileTree(), []);

    useEffect(() => fileTree.update(props.torrent), [props.torrent]);

    const defaultColumn = useMemo(() => ({
        minSize: 30,
        size: 150,
        maxSize: 2000,
    }), []);

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
    }, []);

    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(config.getTableColumnVisibility("filetree"));
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(config.getTableColumnSizes("filetree"));
    const [sorting, setSorting] = useState<SortingState>(config.getTableSortBy("filetree"));

    useEffect(() => config.setTableColumnVisibility("filetree", columnVisibility), [config, columnVisibility]);
    useEffect(() => config.setTableColumnSizes("filetree", columnSizing), [config, columnSizing]);
    useEffect(() => config.setTableSortBy("filetree", sorting), [config, sorting]);

    const data = useMemo(() => fileTree.flatten(), [fileTree.epoch, renderVal]);

    const table = useReactTable<FileDirEntry>({
        columns,
        data,
        defaultColumn,
        enableHiding: true,
        onColumnVisibilityChange: setColumnVisibility,
        enableColumnResizing: true,
        onColumnSizingChange: setColumnSizing,
        enableSorting: true,
        onSortingChange: setSorting,
        state: {
            columnVisibility,
            columnSizing,
            sorting,
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const parentRef = React.useRef(null);
    const rowHeight = React.useMemo(() => {
        const lineHeight = getComputedStyle(document.body).lineHeight.match(/[\d\.]+/);
        return Math.ceil(Number(lineHeight) * 1.1);
    }, []);

    const [lastIndex, setLastIndex] = useState(-1);
    const rowClick = useCallback(
        (event: React.MouseEvent<Element>, index: number, lastIndex: number) => {
            //todo
        },
        []);

    const rowVirtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => parentRef.current,
        paddingStart: rowHeight,
        overscan: 3,
        estimateSize: React.useCallback(() => rowHeight, []),
    });

    return (
        <div ref={parentRef} className="torrent-table-container">
            <div className="torrent-table"
                style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: `${table.getTotalSize()}px` }}>
                <div className="sticky-top bg-light" style={{ height: `${rowHeight}px` }}>
                    {table.getHeaderGroups().map(headerGroup => (
                        <div className="tr" key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <div {...{
                                    key: header.id,
                                    style: {
                                        width: header.getSize(),
                                    },
                                    onClick: header.column.getToggleSortingHandler(),
                                    className: "th"
                                }}>
                                    <span>{header.column.getIsSorted() ? header.column.getIsSorted() == "desc" ? '▼ ' : '▲ ' : ''}</span>
                                    {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                    )}
                                    <div {...{
                                        onMouseDown: header.getResizeHandler(),
                                        onTouchStart: header.getResizeHandler(),
                                        className: `resizer ${header.column.getIsResizing() ? 'isResizing' : ''
                                            }`,
                                        style: {
                                            left: `${header.getStart() + header.getSize() - 3}px`,
                                            transform:
                                                header.column.getIsResizing()
                                                    ? `translateX(${table.getState().columnSizingInfo.deltaOffset
                                                    }px)`
                                                    : '',
                                        },
                                    }} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = table.getRowModel().rows[virtualRow.index];
                        return <FileTableRow
                            key={virtualRow.index} torrent={props.torrent} mappings={serverConfig.pathMappings}
                            row={row} index={virtualRow.index} lastIndex={lastIndex}
                            start={virtualRow.start} rowClick={rowClick} height={rowHeight}
                            columnSizingState={columnSizing} columnVisibilityState={columnVisibility}
                        />;
                    })}
                </div>
            </div>
        </div>
    );
}
