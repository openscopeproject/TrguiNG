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

import React, { useCallback, useContext, useMemo, useState } from "react";
import { Badge } from "react-bootstrap";
import { useTable, useColumnOrder, useSortBy, useBlockLayout, useResizeColumns, useRowSelect, Accessor, Column, CellProps, TableState, ActionType, Row } from "react-table";
import { useVirtual } from "react-virtual";
import { CachedFileTree, DirEntry, FileDirEntry, isDirEntry } from "../cachedfiletree";
import { ConfigContext } from "../config";
import { PriorityColors, PriorityStrings } from "../rpc/transmission";
import { bytesToHumanReadableStr, useForceRender } from "../util";
import { ProgressBar } from "./progressbar";
import * as Icon from "react-bootstrap-icons";


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

interface FileTreeTableProps {
    tree: CachedFileTree,
}

function FileTableRow(props: {
    row: Row<FileDirEntry>,
    index: number,
    start: number,
    lastIndex: number,
    rowClick: (e: React.MouseEvent<Element>, i: number, li: number) => void,
    height: number,
}) {
    return (
        <div {...props.row.getRowProps()}
            className={`tr ${/*props.row.original.isSelected ? " selected" : */""} ${props.index % 2 ? " odd" : ""}`}
            style={{ height: `${props.height}px`, transform: `translateY(${props.start}px)` }}
            onClick={(e) => {
                props.rowClick(e, props.index, props.lastIndex);
            }}
        >
            {props.row.cells.map(cell => {
                return (
                    <div {...cell.getCellProps()} className="td">
                        {cell.render('Cell')}
                    </div>
                )
            })}
        </div>
    );
}

export function FileTreeTable(props: FileTreeTableProps) {
    const config = useContext(ConfigContext);
    const forceRender = useForceRender();

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
        const fields = config.getTableFields("filetree");

        return AllFields.map((field): Column<FileDirEntry> => {
            const cell = (props: CellProps<FileDirEntry>) => {
                return <field.component
                    fieldName={field.name}
                    entry={props.row.original}
                    forceRender={forceRender} />
            }
            var column: Column<FileDirEntry> = {
                Header: field.label,
                accessor: field.name,
                Cell: cell,
                minWidth: 30,
                width: 150,
                maxWidth: 2000,
            }
            var f = fields.find((f) => f.name == column.accessor || f.name == column.id);
            if (f) column.width = f.width;
            if (f?.name == "name") column.sortType = nameSortFunc;
            return column;
        });
    }, [config]);

    const [hiddenColumns, columnOrder, sortBy] = useMemo(() => {
        const fields = AllFields.map((f) => f.name);
        const visibleFields = config.getTableFields("filetree").map((f) => f.name);
        return [
            fields.filter((f) => !visibleFields.includes(f)),
            visibleFields,
            config.getTableSortBy("filetree")
        ];
    }, [config]);

    const stateChange = useCallback((state: TableState<FileDirEntry>, action: ActionType) => {
        config.processTableStateChange("filetree", AllFields.map((f) => f.name), state, action);
        return state;
    }, [config]);

    const data = props.tree.flatten();

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
        totalColumnsWidth,
    } = useTable<FileDirEntry>(
        {
            columns,
            data,
            autoResetSortBy: false,
            autoResetResize: false,
            autoResetSelectedRows: false,
            stateReducer: stateChange,
            initialState: {
                hiddenColumns,
                columnOrder,
                sortBy,
            }
        },
        useColumnOrder,
        useSortBy,
        useBlockLayout,
        useResizeColumns,
        useRowSelect
    );

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
        [rows]);

    const rowVirtualizer = useVirtual({
        size: data.length,
        parentRef,
        paddingStart: rowHeight,
        overscan: 3,
        estimateSize: React.useCallback(() => rowHeight, []),
    });

    return (
        <div ref={parentRef} className="torrent-table-container">
            <div {...getTableProps()}
                className="torrent-table"
                style={{ height: `${rowVirtualizer.totalSize}px`, width: `${totalColumnsWidth}px` }}>
                <div className="sticky-top bg-light" style={{ height: `${rowHeight}px` }}>
                    {headerGroups.map(headerGroup => (
                        <div {...headerGroup.getHeaderGroupProps()} className="tr">
                            {headerGroup.headers.map(column => (
                                <div {...column.getHeaderProps(column.getSortByToggleProps())} className="th">
                                    <span>{column.isSorted ? column.isSortedDesc ? '▼ ' : '▲ ' : ''}</span>
                                    {column.render('Header')}
                                    <div {...column.getResizerProps()} className="resizer" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div {...getTableBodyProps()}>
                    {rowVirtualizer.virtualItems.map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        prepareRow(row);
                        return <FileTableRow
                            key={virtualRow.index}
                            row={row} index={virtualRow.index} lastIndex={lastIndex}
                            start={virtualRow.start} rowClick={rowClick} height={rowHeight}
                        />;
                    })}
                </div>
            </div>
        </div>
    );
}
