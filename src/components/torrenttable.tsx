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

import '../css/torrenttable.css';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Badge } from 'react-bootstrap';
import { Torrent } from '../rpc/torrent';
import { PriorityColors, PriorityStrings, Status, StatusStrings, TorrentFieldsType } from '../rpc/transmission';
import { useReactTable, Row, ColumnSizingState, SortingState, VisibilityState, ColumnDef, getCoreRowModel, flexRender, getSortedRowModel } from '@tanstack/react-table';
import { ConfigContext } from '../config';
import { bytesToHumanReadableStr, secondsToHumanReadableStr, timestampToDateString } from '../util';
import { ProgressBar } from './progressbar';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AccessorFn, CellContext } from '@tanstack/table-core';

interface TableFieldProps {
    torrent: Torrent,
    fieldName: string,
    className?: string,
    active?: boolean
}

interface TableField {
    name: TorrentFieldsType,
    label: string,
    component: React.FunctionComponent<TableFieldProps>,
    columnId?: string,
    accessorFn?: AccessorFn<Torrent>,
}

const AllFields: readonly TableField[] = [
    { name: "name", label: "Name", component: StringField },
    { name: "totalSize", label: "Size", component: ByteSizeField },
    { name: "haveValid", label: "Downloaded", component: ByteSizeField },
    { name: "percentDone", label: "Done", component: PercentBarField },
    { name: "rateDownload", label: "Down speed", component: ByteRateField },
    { name: "rateUpload", label: "Up speed", component: ByteRateField },
    { name: "status", label: "Status", component: StatusField },
    { name: "addedDate", label: "Added on", component: DateField },
    { name: "peersSendingToUs", label: "Seeds", component: StringField },
    { name: "peersGettingFromUs", label: "Peers", component: StringField },
    { name: "eta", label: "ETA", component: EtaField },
    { name: "uploadRatio", label: "Ratio", component: StringField },
    { name: "trackerStats", label: "Tracker", component: TrackerField },
    {
        name: "trackerStats", label: "Tracker status", component: TrackerStatusField,
        columnId: "trackerStatus", accessorFn: getTrackerStatus
    },
    { name: "doneDate", label: "Completed on", component: DateField },
    { name: "activityDate", label: "Last active", component: DateField },
    { name: "downloadDir", label: "Path", component: StringField },
    { name: "bandwidthPriority", label: "Priority", component: PriorityField },
    { name: "sizeWhenDone", label: "Size to download", component: ByteSizeField },
    { name: "id", label: "ID", component: StringField },
    { name: "queuePosition", label: "Queue position", component: StringField },
    { name: "secondsSeeding", label: "Seeding time", component: TimeField },
    { name: "leftUntilDone", label: "Size left", component: ByteSizeField },
    { name: "isPrivate", label: "Private", component: StringField }, //
    { name: "labels", label: "Labels", component: LabelsField },
    { name: "group", label: "Bandwidth group", component: StringField }, //
] as const;

function StringField(props: TableFieldProps) {
    return <>
        {props.torrent[props.fieldName]}
    </>;
}

function TimeField(props: TableFieldProps) {
    return <>{secondsToHumanReadableStr(props.torrent[props.fieldName])}</>;
}

export function EtaField(props: TableFieldProps) {
    var seconds = props.torrent[props.fieldName];
    if (seconds >= 0) return <TimeField {...props} />;
    else if (seconds == -1) return <></>;
    else return <>Unknown</>;
}

export function TrackerField(props: TableFieldProps) {
    const trackers = props.torrent.trackerStats;
    return <>{trackers.length ? trackers[0].host : "No tracker"}</>;
}

function getTrackerStatus(torrent: Torrent): string {
    var trackers = torrent.trackerStats;
    if (torrent.status == Status.stopped || trackers.length == 0) return "";
    var tracker = trackers[0];
    if (tracker.announceState == 2 || tracker.announceState == 3) return "Working";
    if (tracker.hasAnnounced) {
        if (tracker.lastAnnounceSucceeded) return "Working";
        if (tracker.lastAnnounceResult == "Success") return "Working";
        return tracker.lastAnnounceResult;
    }
    return "";
}

function TrackerStatusField(props: TableFieldProps) {
    return <>{getTrackerStatus(props.torrent)}</>;
}

function PriorityField(props: TableFieldProps) {
    const priority = props.torrent[props.fieldName];
    return <Badge pill bg={PriorityColors.get(priority)!}>{PriorityStrings.get(priority)}</Badge>;
}

export function LabelsField(props: TableFieldProps) {
    const labels: string[] = props.torrent.labels;
    return <>
        {labels.map((label) => <Badge key={label} bg="primary" className="torrent-label white-outline">{label}</Badge>)}
    </>;
}

export function StatusField(props: TableFieldProps) {
    const status = StatusStrings[props.torrent.status];
    return <>{status}</>;
}

export function DateField(props: TableFieldProps) {
    const date = timestampToDateString(props.torrent[props.fieldName]);
    return <span className={props.className}>{date}</span>;
}

function ByteSizeField(props: TableFieldProps) {
    const stringValue = useMemo(() => {
        return bytesToHumanReadableStr(props.torrent[props.fieldName]);
    }, [props.torrent[props.fieldName]]);

    return <div className={props.className}>{stringValue}</div>;
}

function ByteRateField(props: TableFieldProps) {
    const stringValue = useMemo(() => {
        return `${bytesToHumanReadableStr(props.torrent[props.fieldName])}/s`;
    }, [props.torrent[props.fieldName]]);

    return <div className={props.className}>{stringValue}</div>;
}

function PercentBarField(props: TableFieldProps) {
    const now = props.torrent[props.fieldName] * 100;

    return <ProgressBar
        now={now}
        className="white-outline"
        {...(props.active ? { animate: true } : {})}
    />
}

interface TorrentTableProps {
    torrents: Torrent[];
    setCurrentTorrent: (id: number) => void;
    selectedTorrents: Set<number>,
    selectedReducer: React.Dispatch<{ verb: string; ids: number[]; }>
}

const defaultColumns = AllFields.map((f): ColumnDef<Torrent> => {
    const cell = (props: CellContext<Torrent, unknown>) => {
        const active = props.row.original.rateDownload > 0 || props.row.original.rateUpload > 0;
        return <f.component fieldName={f.name} torrent={props.row.original} active={active} />
    };
    if (f.accessorFn) return {
        header: f.label,
        accessorFn: f.accessorFn,
        id: f.columnId!,
        cell
    }
    return {
        header: f.label,
        accessorKey: f.name,
        cell
    };
});

function TorrentTableRow(props: {
    row: Row<Torrent>,
    index: number,
    start: number,
    lastIndex: number,
    rowClick: (e: React.MouseEvent<Element>, i: number, li: number) => void,
    height: number,
}) {
    return (
        <div
            className={`tr ${props.row.original.isSelected ? " selected" : ""} ${props.index % 2 ? " odd" : ""}`}
            style={{ height: `${props.height}px`, transform: `translateY(${props.start}px)` }}
            onClick={(e) => {
                props.rowClick(e, props.index, props.lastIndex);
            }}
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
}

export function TorrentTable(props: TorrentTableProps) {
    const config = useContext(ConfigContext);

    const defaultColumn = useMemo(() => ({
        minSize: 30,
        size: 150,
        maxSize: 2000,
    }), []);

    const getRowId = useCallback((t: Torrent) => String(t.id), []);

    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(config.getTableColumnVisibility("torrents"));
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(config.getTableColumnSizes("torrents"));
    const [sorting, setSorting] = useState<SortingState>(config.getTableSortBy("torrents"));

    useEffect(() => config.setTableColumnVisibility("torrents", columnVisibility), [config, columnVisibility]);
    useEffect(() => config.setTableColumnSizes("torrents", columnSizing), [config, columnSizing]);
    useEffect(() => config.setTableSortBy("torrents", sorting), [config, sorting]);

    const [lastIndex, setLastIndex] = useState(-1);

    const data = useMemo(() => {
        return props.torrents.map((t) => {
            return { ...t, isSelected: props.selectedTorrents.has(t.id) };
        });
    }, [props.torrents, props.selectedTorrents]);

    const table = useReactTable<Torrent>({
        columns: defaultColumns,
        data,
        defaultColumn,
        getRowId,
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

    const rowClick = useCallback((event: React.MouseEvent<Element>, index: number, lastIndex: number) => {
        const rows = table.getRowModel().rows;
        event.preventDefault();
        event.stopPropagation();

        function genIds() {
            var minIndex = Math.min(index, lastIndex);
            var maxIndex = Math.max(index, lastIndex);
            var ids = [];
            for (var i = minIndex; i <= maxIndex; i++)
                ids.push(rows[i].original.id);
            return ids;
        }

        if (event.shiftKey && event.ctrlKey && lastIndex != -1) {
            var ids = genIds();
            props.selectedReducer({ verb: "add", ids });
        } else if (event.shiftKey && lastIndex != -1) {
            var ids = genIds();
            props.selectedReducer({ verb: "set", ids });
        } else if (event.ctrlKey) {
            props.selectedReducer({ verb: "add", ids: [rows[index].original.id] });
        } else {
            props.selectedReducer({ verb: "set", ids: [rows[index].original.id] });
        }

        if (event.shiftKey) {
            document.getSelection()?.removeAllRanges();
        } else {
            setLastIndex(index);
        }
        props.setCurrentTorrent(rows[index].original.id);
    }, [props.selectedReducer, setLastIndex, table]);

    const parentRef = React.useRef(null);
    const rowHeight = React.useMemo(() => {
        const lineHeight = getComputedStyle(document.body).lineHeight.match(/[\d\.]+/);
        return Math.ceil(Number(lineHeight) * 1.1);
    }, []);

    const rowVirtualizer = useVirtualizer({
        count: props.torrents.length,
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
                                        className: `resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`,
                                        style: {
                                            left: `${header.getStart() + header.getSize() - 3}px`,
                                            transform:
                                                header.column.getIsResizing()
                                                    ? `translateX(${table.getState().columnSizingInfo.deltaOffset}px)`
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
                        return <TorrentTableRow
                            key={row.original.id}
                            row={row} index={virtualRow.index} lastIndex={lastIndex}
                            start={virtualRow.start} rowClick={rowClick} height={rowHeight}
                        />;
                    })}
                </div>
            </div>
        </div >

    );
}
