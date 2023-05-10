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

import { Box, Menu } from "@mantine/core";
import * as Icon from "react-bootstrap-icons";
import {
    useReactTable, type Table, type ColumnDef, type ColumnSizingState,
    type SortingState, type VisibilityState, getCoreRowModel,
    getSortedRowModel, flexRender, type Row, type Column, type RowSelectionState
} from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { ContextMenu, useContextMenu } from "components/contextmenu";
import { ConfigContext, type TableName } from "config";
import React, { memo, useReducer, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const defaultColumn = {
    minSize: 30,
    size: 150,
    maxSize: 2000,
};

function useTable<TData>(
    tablename: TableName,
    columns: Array<ColumnDef<TData, unknown>>,
    data: TData[],
    selected: string[],
    getRowId: (r: TData) => string,
    onVisibilityChange?: React.Dispatch<VisibilityState>,
): [Table<TData>, VisibilityState, (v: VisibilityState) => void, ColumnSizingState] {
    const config = useContext(ConfigContext);

    const [columnVisibility, setColumnVisibility] =
        useState<VisibilityState>(config.getTableColumnVisibility(tablename));
    const [columnSizing, setColumnSizing] =
        useState<ColumnSizingState>(config.getTableColumnSizes(tablename));
    const [sorting, setSorting] =
        useState<SortingState>(config.getTableSortBy(tablename));
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    useEffect(() => {
        config.setTableColumnVisibility(tablename, columnVisibility);
        onVisibilityChange?.(columnVisibility);
    }, [config, columnVisibility, onVisibilityChange, tablename]);
    useEffect(() => {
        config.setTableColumnSizes(tablename, columnSizing);
    }, [config, columnSizing, tablename]);
    useEffect(() => {
        config.setTableSortBy(tablename, sorting);
    }, [config, sorting, tablename]);
    useEffect(() => {
        setRowSelection(Object.fromEntries(selected.map((id) => [id, true])));
    }, [selected]);

    const table = useReactTable<TData>({
        columns,
        data,
        defaultColumn,
        getRowId,
        enableHiding: true,
        onColumnVisibilityChange: setColumnVisibility,
        enableColumnResizing: true,
        onColumnSizingChange: setColumnSizing,
        enableSorting: true,
        onSortingChange: setSorting,
        enableRowSelection: true,
        state: {
            columnVisibility,
            columnSizing,
            sorting,
            rowSelection,
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return [table, columnVisibility, setColumnVisibility, columnSizing];
}

function useSelectHandler<TData>(
    table: Table<TData>,
    selectedReducer: ({ verb, ids }: { verb: "add" | "set", ids: string[] }) => void,
    getRowId: (row: TData) => string,
    setCurrent?: (id: string) => void,
): [number, (event: React.MouseEvent<Element>, index: number, lastIndex: number) => void] {
    const [lastIndex, setLastIndex] = useState(-1);

    const onRowClick = useCallback((event: React.MouseEvent<Element>, index: number, lastIndex: number) => {
        const rows = table.getRowModel().rows;
        event.preventDefault();
        event.stopPropagation();

        function genIds() {
            const minIndex = Math.min(index, lastIndex);
            const maxIndex = Math.max(index, lastIndex);
            const ids = [];
            for (let i = minIndex; i <= maxIndex; i++) {
                ids.push(getRowId(rows[i].original));
            }
            return ids;
        }

        if (event.shiftKey && event.ctrlKey && lastIndex !== -1) {
            const ids = genIds();
            selectedReducer({ verb: "add", ids });
        } else if (event.shiftKey && lastIndex !== -1) {
            const ids = genIds();
            selectedReducer({ verb: "set", ids });
        } else if (event.ctrlKey) {
            selectedReducer({ verb: "add", ids: [getRowId(rows[index].original)] });
        } else {
            selectedReducer({ verb: "set", ids: [getRowId(rows[index].original)] });
        }

        if (event.shiftKey) {
            document.getSelection()?.removeAllRanges();
        } else {
            setLastIndex(index);
        }
        if (setCurrent !== undefined) {
            setCurrent(getRowId(rows[index].original));
        }
    }, [getRowId, selectedReducer, setCurrent, table]);

    return [lastIndex, onRowClick];
}

function useTableVirtualizer(count: number): [React.MutableRefObject<null>, number, Virtualizer<Element, Element>] {
    const parentRef = useRef(null);
    const rowHeight = useMemo(() => {
        const lineHeight = getComputedStyle(document.body).lineHeight.match(/[\d.]+/);
        return Math.ceil(Number(lineHeight) * 1.1);
    }, []);

    const rowVirtualizer = useVirtualizer({
        count,
        getScrollElement: () => parentRef.current,
        paddingStart: rowHeight,
        overscan: 3,
        estimateSize: useCallback(() => rowHeight, [rowHeight]),
    });

    return [parentRef, rowHeight, rowVirtualizer];
}

function useColumnMenu<TData>(
    columnVisibility: VisibilityState,
    setColumnVisibility: (v: VisibilityState) => void,
    columns: Array<Column<TData, unknown>>
): [React.MouseEventHandler<HTMLDivElement>, React.ReactElement] {
    const [info, setInfo, handler] = useContextMenu();

    const onColumnMenuItemClick = useCallback((value: string, checked: boolean) => {
        setColumnVisibility({ ...columnVisibility, [value]: checked });
    }, [columnVisibility, setColumnVisibility]);

    return [
        handler,
        // eslint-disable-next-line react/jsx-key
        <ContextMenu
            contextMenuInfo={info}
            setContextMenuInfo={setInfo}
            closeOnItemClick={false}
        >
            {columns.map(column => {
                const visible = !(column.id in columnVisibility) || columnVisibility[column.id];
                return <Menu.Item key={column.id}
                    icon={visible ? <Icon.Check size="1rem" /> : <Box miw="1rem" />}
                    onClick={() => { onColumnMenuItemClick(column.id, !visible); }}
                >
                    {column.columnDef.header as string}
                </Menu.Item>;
            })}
        </ContextMenu >
    ];
}

export function useStandardSelect(): [string[], React.Dispatch<{ verb: "add" | "set", ids: string[] }>] {
    const [selected, selectedReducer] = useReducer(
        (old: string[], action: { verb: "add" | "set", ids: string[] }) => {
            if (action.verb === "set") return action.ids;
            else {
                const newset = new Set(old);
                action.ids.forEach((id) => newset.add(id));
                return Array.from(newset);
            }
        }, []
    );

    return [selected, selectedReducer];
}

function InnerRow<TData>(props: {
    row: Row<TData>,
    columnSizing: ColumnSizingState,
    columnVisibility: VisibilityState,
}) {
    return <>
        {props.row.getVisibleCells().map(cell => {
            return (
                <div key={cell.id} className="td" style={{
                    width: cell.column.getSize()
                }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div >
            );
        })}
    </>;
}

const MemoizedInnerRow = memo(InnerRow, (prev, next) => {
    return (
        prev.row.original === next.row.original &&
        prev.columnSizing === next.columnSizing &&
        prev.columnVisibility === next.columnVisibility
    );
}) as typeof InnerRow;

function TableRow<TData>(props: {
    row: Row<TData>,
    selected: boolean,
    index: number,
    start: number,
    lastIndex: number,
    onRowClick: (e: React.MouseEvent<Element>, i: number, li: number) => void,
    onRowDoubleClick?: (row: TData) => void,
    height: number,
    columnSizing: ColumnSizingState,
    columnVisibility: VisibilityState,
}) {
    const { onRowDoubleClick: propsDblClick, row } = props;
    const onRowDoubleClick = useCallback(() => {
        if (propsDblClick !== undefined) {
            propsDblClick(row.original);
        }
    }, [propsDblClick, row.original]);

    return (
        <div
            className={`tr${props.selected ? " selected" : ""}`}
            style={{ height: `${props.height}px`, transform: `translateY(${props.start}px)` }}
            onClick={(e) => {
                props.onRowClick(e, props.index, props.lastIndex);
            }}
            onDoubleClick={onRowDoubleClick}
        >
            <MemoizedInnerRow {...props} />
        </div>
    );
}

const MemoizedTableRow = memo(TableRow) as typeof TableRow;

export function TransguiTable<TData>(props: {
    tablename: TableName,
    columns: Array<ColumnDef<TData, unknown>>,
    data: TData[],
    selected: string[],
    getRowId: (r: TData) => string,
    selectedReducer: ({ verb, ids }: { verb: "add" | "set", ids: string[] }) => void,
    setCurrent?: (id: string) => void,
    onRowDoubleClick?: (row: TData) => void,
    onVisibilityChange?: React.Dispatch<VisibilityState>,
}) {
    const [table, columnVisibility, setColumnVisibility, columnSizing] =
        useTable(props.tablename, props.columns, props.data, props.selected, props.getRowId, props.onVisibilityChange);

    const [lastIndex, onRowClick] = useSelectHandler(
        table, props.selectedReducer, props.getRowId, props.setCurrent);

    const [parentRef, rowHeight, virtualizer] = useTableVirtualizer(props.data.length);

    const [menuContextHandler, columnMenu] = useColumnMenu(
        columnVisibility, setColumnVisibility, table.getAllLeafColumns());

    return (
        <div ref={parentRef} className="torrent-table-container">
            <div className="torrent-table"
                style={{ height: `${virtualizer.getTotalSize()}px`, width: `${table.getTotalSize()}px` }}>
                <Box sx={(theme) => ({
                    height: `${rowHeight}px`,
                    backgroundColor: theme.colorScheme === "dark" ? theme.colors.dark[5] : theme.colors.gray[2],
                    zIndex: 3,
                    position: "sticky",
                    top: 0,
                })}>
                    {table.getHeaderGroups().map(headerGroup => (
                        <div className="tr" key={headerGroup.id}
                            onContextMenu={menuContextHandler}
                        >
                            {columnMenu}
                            {headerGroup.headers.map(header => (
                                <div key={header.id} className="th" style={{
                                    width: header.getSize(),
                                }}>
                                    <div onClick={header.column.getToggleSortingHandler()}>
                                        <span>
                                            {header.column.getIsSorted() !== false
                                                ? header.column.getIsSorted() === "desc"
                                                    ? "▼ "
                                                    : "▲ "
                                                : ""}
                                        </span>
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                    </div>
                                    <div {...{
                                        onMouseDown: header.getResizeHandler(),
                                        onTouchStart: header.getResizeHandler(),
                                        className: `resizer ${header.column.getIsResizing() ? "isResizing" : ""}`,
                                        style: {
                                            left: `${header.getStart() + header.getSize() - 3}px`,
                                            transform:
                                                header.column.getIsResizing()
                                                    ? `translateX(${table.getState().columnSizingInfo.deltaOffset ?? 0}px)`
                                                    : "",
                                        },
                                    }} />
                                </div>
                            ))}
                        </div>
                    ))}
                </Box>

                {virtualizer.getVirtualItems()
                    // drop first row if it is odd one to keep nth-child(odd) selector
                    // stable this prevents flickering row background on scroll
                    .filter((virtualRow, virtualIndex) => (virtualIndex !== 0 || virtualRow.index % 2 === 0))
                    .map((virtualRow) => {
                        const row = table.getRowModel().rows[virtualRow.index];
                        return <MemoizedTableRow<TData> key={props.getRowId(row.original)} {...{
                            row,
                            selected: row.getIsSelected(),
                            index: virtualRow.index,
                            lastIndex,
                            start: virtualRow.start,
                            onRowClick,
                            onRowDoubleClick: props.onRowDoubleClick,
                            height: rowHeight,
                            columnSizing,
                            columnVisibility,
                        }} />;
                    })}
            </div >
        </div >
    );
}
