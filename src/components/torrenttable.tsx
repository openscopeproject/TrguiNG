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
import React, { useCallback, useContext, useMemo } from 'react';
import { Badge } from 'react-bootstrap';
import { TorrentFilter } from './filters';
import { Torrent } from '../rpc/torrent';
import { PriorityColors, PriorityStrings, Status, StatusStrings, TorrentFieldsType } from '../rpc/transmission';
import { useTable, useBlockLayout, useResizeColumns, useRowSelect, Column, CellProps, useColumnOrder, TableState, Accessor, useSortBy } from 'react-table';
import { ConfigContext, TableFieldConfig } from '../config';
import { Duration } from 'luxon';
import { bytesToHumanReadableStr, secondsToHumanReadableStr, timestampToDateString } from '../util';
import { ProgressBar } from './progressbar';
import { useVirtual } from 'react-virtual';

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
    accessor?: Accessor<Torrent>,
}

const allFields: TableField[] = [
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
        columnId: "trackerStatus", accessor: getTrackerStatus
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
];

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
    currentFilter: TorrentFilter;
    setCurrentTorrent: (t: Torrent) => void;
}

const defaultColumns = allFields.map((f): Column<Torrent> => {
    const cell = (props: CellProps<Torrent>) => {
        const active = props.row.original.rateDownload > 0 || props.row.original.rateUpload > 0;
        return <f.component fieldName={f.name} torrent={props.row.original} active={active} />
    };
    if (f.accessor) return {
        Header: f.label,
        accessor: f.accessor,
        id: f.columnId!,
        Cell: cell
    }
    return {
        Header: f.label,
        accessor: f.name,
        Cell: cell
    };
});

export function TorrentTable(props: TorrentTableProps) {
    const config = useContext(ConfigContext);

    const defaultColumn = useMemo(() => ({
        minWidth: 30,
        width: 150,
        maxWidth: 2000,
    }), []);

    const columns = useMemo(() => {
        const fields = config.getTableFields("torrents");

        return defaultColumns.map((column) => {
            Object.assign(column, defaultColumn);
            var f = fields.find((f) => f.name == column.accessor || f.name == column.id);
            if (f) column.width = f.width;
            return column;
        });
    }, [config]);

    const getRowId = useCallback((t: Torrent, i: number) => String(t.id), []);

    const hiddenColumns = useMemo(() => {
        const fields = allFields.map((f) => f.name);
        const visibleFields = config.getTableFields("torrents").map((f) => f.name);
        if (visibleFields.length == 0) return [];
        return fields.filter((f) => !visibleFields.includes(f));
    }, [config]);

    const columnOrder = useMemo(() => {
        return config.getTableFields("torrents").map((f) => f.name);
    }, [config]);

    const sortBy = useMemo(() => {
        return config.getTableSortBy("torrents");
    }, [config]);

    const stateChange = useCallback((state: TableState<Torrent>) => {
        const order = state.columnOrder.length ? state.columnOrder : allFields.map((f) => f.name);
        const visible = order.filter(
            (f) => state.hiddenColumns ? !state.hiddenColumns.includes(f) : true);
        const oldFields = config.getTableFields("torrents");
        const fields: TableFieldConfig[] = visible.map((f) => {
            const newWidths = state.columnResizing.columnWidths;
            var width = defaultColumn.width;
            var oldField = oldFields.find((oldfield) => oldfield.name == f);
            if (oldField) width = oldField.width;
            if (f in newWidths) width = newWidths[f];
            return {
                name: f,
                width
            }
        });
        config.setTableFields("torrents", fields);
        config.setTableSortBy("torrents", state.sortBy.map((r) => {
            return { id: r.id, desc: r.desc || false };
        }));

        return state;
    }, []);


    const data = useMemo(() => props.torrents.filter(props.currentFilter.filter), [props]);

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
        totalColumnsWidth,
    } = useTable<Torrent>(
        {
            columns,
            data,
            defaultColumn,
            getRowId,
            autoResetSelectedRows: false,
            autoResetSortBy: false,
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
                                    {/* Use column.getResizerProps to hook up the events correctly */}
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
                        return (
                            <div {...row.getRowProps()}
                                className={`tr ${row.isSelected ? " bg-primary text-white" : virtualRow.index % 2 ? "bg-light" : ""}`}
                                style={{ height: `${rowHeight}px`, transform: `translateY(${virtualRow.start}px)` }}
                                onClick={() => { row.toggleRowSelected(true); props.setCurrentTorrent(row.original); }}
                            >
                                {row.cells.map(cell => {
                                    return (
                                        <div {...cell.getCellProps()} className="td">
                                            {cell.render('Cell')}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>

    );
}
