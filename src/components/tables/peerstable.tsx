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

import type { AccessorFn, CellContext, ColumnDef } from "@tanstack/react-table";
import React, { useMemo, useCallback } from "react";
import type { Torrent, PeerStats } from "rpc/torrent";
import type { PeerStatsFieldsType } from "rpc/transmission";
import { bytesToHumanReadableStr } from "util";
import { TransguiTable, useStandardSelect } from "./common";

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
    const field = props.entry[props.fieldName];
    const stringValue = useMemo(() => {
        return `${bytesToHumanReadableStr(field)}/s`;
    }, [field]);

    return <div>{stringValue}</div>;
}

function PercentField(props: TableFieldProps) {
    const value = props.entry[props.fieldName];
    return <div>{`${Math.round(value * 1000) / 10}%`}</div>;
}

const Columns = AllFields.map((field): ColumnDef<PeerStats> => {
    const cell = (props: CellContext<PeerStats, unknown>) => {
        if (field.component !== undefined) {
            return <field.component entry={props.row.original} fieldName={field.name} />;
        } else {
            return <div>{props.getValue() as string}</div>;
        }
    };
    const column: ColumnDef<PeerStats> = {
        header: field.label,
        accessorKey: field.name,
        accessorFn: field.accessorFn,
        cell,
    };
    return column;
});

export function PeersTable(props: { torrent: Torrent }) {
    const getRowId = useCallback((t: PeerStats) => `${t.address as string}:${t.port as number}`, []);

    const [selected, selectedReducer] = useStandardSelect();

    return <TransguiTable<PeerStats> {...{
        tablename: "peers",
        columns: Columns,
        data: props.torrent.peers,
        selected,
        getRowId,
        selectedReducer,
    }} />;
}
