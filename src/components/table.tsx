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

import React, { useCallback, useMemo, useState } from 'react';
import { ProgressBar, Table } from 'react-bootstrap';
import { TorrentFilter } from './filters';
import { Torrent } from '../rpc/torrent';
import '../css/torrenttable.css';
import { StatusStrings } from '../rpc/transmission';
import { useTable, useBlockLayout, useResizeColumns, useRowSelect, Column, CellProps } from 'react-table';

interface TableFieldProps {
    torrent: Torrent,
    fieldName: string,
    className?: string,
    active?: boolean
}

interface TableField {
    name: string,
    label: string,
    component: React.FunctionComponent<TableFieldProps>,
}

const fields: TableField[] = [
    { name: "name", label: "Name", component: StringField },
    { name: "sizeWhenDone", label: "Size", component: ByteSizeField },
    { name: "haveValid", label: "Downloaded", component: ByteSizeField },
    { name: "percentDone", label: "Done", component: PercentBarField },
    { name: "rateDownload", label: "Down speed", component: ByteRateField },
    { name: "rateUpload", label: "Up speed", component: ByteRateField },
    { name: "status", label: "Status", component: StatusField },
    { name: "addedDate", label: "Added on", component: DateField },
]

function StringField(props: TableFieldProps) {
    return <>
        {props.torrent[props.fieldName]}
    </>;
}

function StatusField(props: TableFieldProps) {
    const status = StatusStrings[props.torrent.status];
    return <div className={props.className}>{status}</div>;
}

function DateField(props: TableFieldProps) {
    const date = new Date(props.torrent[props.fieldName] * 1000).toLocaleString();
    return <div className={props.className}>{date}</div>;
}

const SISuffixes = ["B", "KB", "MB", "GB", "TB"];

function bytesToHumanReadableStr(value: number): string {
    var unit = "";
    var divisor = 1.0;

    for (var i in SISuffixes) {
        unit = SISuffixes[i];
        if (value < 1024 * divisor) break;
        divisor *= 1024;
    }

    var tmp = String(value / divisor);
    var result = tmp.includes(".") ? tmp.substring(0, 4) : tmp.substring(0, 3);

    return `${result} ${unit}`;
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
    const now = Math.round(props.torrent[props.fieldName] * 100);

    return <ProgressBar
        now={now}
        className={props.className}
        label={`${now}%`}
        {...(props.active ? ["striped", "animated"] : [])}
    />
}

interface TorrentTableProps {
    torrents: Torrent[];
    currentFilter: TorrentFilter;
    setCurrentTorrent: (t: Torrent) => void;
}

const defaultColumns = fields.map((f): Column<Torrent> => {
    return {
        Header: f.label,
        accessor: f.name,
        Cell: (props: CellProps<Torrent>) => {
            const active = props.row.original.downRate > 0 || props.row.original.upRate > 0;
            return <f.component fieldName={f.name} torrent={props.row.original} active={active} />
        }
    }
});

export function TorrentTable(props: TorrentTableProps) {
    const defaultColumn = useMemo(
        () => ({
            minWidth: 30,
            width: 150,
            maxWidth: 400,
        }),
        []
    );

    const getRowId = useCallback((t, i) => String(t.id), []);

    const data = useMemo(() => props.torrents.filter(props.currentFilter.filter), [props]);

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
        state,
    } = useTable<Torrent>(
        {
            columns: defaultColumns,
            data,
            defaultColumn,
            getRowId,
            autoResetSelectedRows: false,
        },
        useBlockLayout,
        useResizeColumns,
        useRowSelect
    );

    return (
        <div>
            <div {...getTableProps()} className="torrent-table table table-striped table-bordered table-  hover">
                <div className="sticky-top bg-light">
                    {headerGroups.map(headerGroup => (
                        <div {...headerGroup.getHeaderGroupProps()} className="tr">
                            {headerGroup.headers.map(column => (
                                <div {...column.getHeaderProps()} className="th">
                                    {column.render('Header')}
                                    {/* Use column.getResizerProps to hook up the events correctly */}
                                    <div {...column.getResizerProps()} className="resizer" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div {...getTableBodyProps()}>
                    {rows.map((row, i) => {
                        prepareRow(row)
                        return (
                            <div {...row.getRowProps()} className={`tr ${row.isSelected ? " bg-primary text-white" : ""}`}
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
