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

import { AccessorFn, CellContext, ColumnDef } from "@tanstack/react-table";
import React, { useMemo, useReducer } from "react";
import { useCallback } from "react";
import { Torrent, PeerStats } from "rpc/torrent";
import { PeerStatsFieldsType } from "rpc/transmission";
import { bytesToHumanReadableStr } from "util";
import { Table, useStandardSelect } from "./common";


interface TableFieldProps {
    entry: PeerStats,
    fieldName: PeerStatsFieldsType,
}

interface TableField {
    name: PeerStatsFieldsType,
    label: string,
    columnId?: string,
    accessorFn?: AccessorFn<PeerStats>,
    component?: React.FunctionComponent<TableFieldProps>,
}

const AllFields: readonly TableField[] = [
    { name: "address", label: "Address" },
    { name: "port", label: "Port" },
    { name: "clientName", label: "Client" },
    { name: "flagStr", label: "Flags" },
    { name: "progress", label: "Have", component: PercentField },
    { name: "rateToPeer", label: "Up speed", component: ByteRateField },
    { name: "rateToClient", label: "Down speed", component: ByteRateField },
] as const;

function ByteRateField(props: TableFieldProps) {
    const stringValue = useMemo(() => {
        return `${bytesToHumanReadableStr(props.entry[props.fieldName])}/s`;
    }, [props.entry[props.fieldName]]);

    return <>{stringValue}</>;
}

function PercentField(props: TableFieldProps) {
    const value = props.entry[props.fieldName];
    return <>{`${Math.round(value * 1000) / 10}%`}</>;
}

const Columns = AllFields.map((field): ColumnDef<PeerStats> => {
    const cell = (props: CellContext<PeerStats, unknown>) => {
        if (field.component)
            return <field.component entry={props.row.original} fieldName={field.name} />;
        else
            return <>{props.getValue()}</>;
    }
    let column: ColumnDef<PeerStats> = {
        header: field.label,
        accessorKey: field.name,
        accessorFn: field.accessorFn,
        cell
    }
    return column;
})

export function PeersTable(props: { torrent: Torrent }) {

    const getRowId = useCallback((t: PeerStats) => `${t.address}:${t.port}`, []);

    const [, selectedReducer, data] = useStandardSelect(
        props.torrent.peers as PeerStats[], getRowId);

    return <Table<PeerStats> {...{
        tablename: "peers",
        columns: Columns,
        data,
        getRowId,
        selectedReducer
    }} />;
}
