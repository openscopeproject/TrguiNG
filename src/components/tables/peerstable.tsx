/**
 * TrguiNG - next gen remote GUI for transmission torrent daemon
 * Copyright (C) 2023  qu1ck (mail at qu1ck.org)
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
import React, { useMemo, useCallback, useContext } from "react";
import type { Torrent, PeerStats } from "rpc/torrent";
import { bytesToHumanReadableStr } from "trutil";
import { TrguiTable, useStandardSelect } from "./common";
import { ProgressBar } from "components/progressbar";
import { Flex } from "@mantine/core";
import { ConfigContext } from "config";
const { TAURI } = await import(/* webpackChunkName: "taurishim" */"taurishim");
if (TAURI) await import(/* webpackChunkName: "flag-icons" */"flagsshim");

interface TableFieldProps {
    entry: PeerStats,
    fieldName: keyof PeerStats,
}

interface TableField {
    name: keyof PeerStats,
    label: string,
    columnId?: string,
    accessorFn?: AccessorFn<PeerStats>,
    component?: React.FunctionComponent<TableFieldProps>,
}

const AllFields: TableField[] = [
    { name: "address", label: "Address" },
    { name: "port", label: "Port" },
    { name: "clientName", label: "Client" },
    { name: "flagStr", label: "Flags" },
    { name: "progress", label: "Have", component: PercentField },
    { name: "rateToPeer", label: "Up speed", component: ByteRateField },
    { name: "rateToClient", label: "Down speed", component: ByteRateField },
    { name: "cachedEncrypted", label: "Encrypted" },
    { name: "cachedFrom", label: "From" },
    { name: "cachedConnection", label: "Connection" },
    { name: "cachedProtocol", label: "Protocol" },
    { name: "cachedStatus", label: "Status" },
];

if (TAURI) AllFields.splice(1, 0, { name: "cachedCountryName", label: "Country", columnId: "country", component: CountryField });

function CountryField(props: TableFieldProps) {
    const iso = props.entry.cachedCountryIso;
    return <Flex gap="sm" style={{ width: "100%" }}>
        {iso !== undefined && <span className={`fi fi-${iso.toLowerCase()}`} style={{ flexShrink: 0 }} />}
        <span>{props.entry.cachedCountryName}</span>
    </Flex>;
}

function ByteRateField(props: TableFieldProps) {
    const field = props.entry[props.fieldName];
    const stringValue = useMemo(() => {
        return field > 0 ? `${bytesToHumanReadableStr(field)}/s` : "";
    }, [field]);

    return <div style={{ width: "100%", textAlign: "right" }}>{stringValue}</div>;
}

function PercentField(props: TableFieldProps) {
    const config = useContext(ConfigContext);
    const now = props.entry[props.fieldName] * 100;
    const active = props.entry.rateToClient > 0 || props.entry.rateToPeer > 0;

    return <ProgressBar
        now={now}
        className="white-outline"
        animate={config.values.interface.animatedProgressbars && active}
        variant={config.values.interface.colorfulProgressbars && now === 100 ? "green" : "default"}
    />;
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
        id: field.columnId,
        accessorFn: field.accessorFn,
        cell,
    };
    return column;
});

export function PeersTable(props: { torrent: Torrent }) {
    const getRowId = useCallback((t: PeerStats) => `${t.address as string}:${t.port as number}`, []);

    const [selected, selectedReducer] = useStandardSelect();

    return <TrguiTable<PeerStats> {...{
        tablename: "peers",
        columns: Columns,
        data: props.torrent.peers,
        selected,
        getRowId,
        selectedReducer,
    }} />;
}
