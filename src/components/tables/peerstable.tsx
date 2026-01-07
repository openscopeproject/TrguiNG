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
import { useTranslation } from "i18n";
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
    { name: "address", label: "torrent.peersTable.address" },
    { name: "port", label: "torrent.peersTable.port" },
    { name: "clientName", label: "torrent.peersTable.client" },
    { name: "flagStr", label: "torrent.peersTable.flags" },
    { name: "progress", label: "torrent.peersTable.have", component: PercentField },
    { name: "rateToPeer", label: "torrent.peersTable.upSpeed", component: ByteRateField },
    { name: "rateToClient", label: "torrent.peersTable.downSpeed", component: ByteRateField },
    { name: "cachedEncrypted", label: "torrent.peersTable.encrypted" },
    { name: "cachedFrom", label: "torrent.peersTable.from" },
    { name: "cachedConnection", label: "torrent.peersTable.connection" },
    { name: "cachedProtocol", label: "torrent.peersTable.protocol" },
    { name: "cachedStatus", label: "torrent.peersTable.status" },
];

if (TAURI) AllFields.splice(1, 0, { name: "cachedCountryName", label: "torrent.peersTable.country", columnId: "country", component: CountryField });

function CountryField(props: TableFieldProps) {
    const { i18n } = useTranslation();
    const iso = props.entry.cachedCountryIso;

    const translatedName = useMemo(() => {
        if (iso === undefined) return props.entry.cachedCountryName;
        try {
            const displayNames = new Intl.DisplayNames([i18n.language], { type: "region" });
            return displayNames.of(iso.toUpperCase()) ?? props.entry.cachedCountryName;
        } catch {
            return props.entry.cachedCountryName;
        }
    }, [iso, i18n.language, props.entry.cachedCountryName]);

    return <Flex gap="sm" style={{ width: "100%" }}>
        {iso !== undefined && <span className={`fi fi-${iso.toLowerCase()}`} style={{ flexShrink: 0 }} />}
        <span>{translatedName}</span>
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

function createPeersColumns(t: (key: string) => string): Array<ColumnDef<PeerStats>> {
    return AllFields.map((field): ColumnDef<PeerStats> => {
        const cell = (props: CellContext<PeerStats, unknown>) => {
            if (field.component !== undefined) {
                return <field.component entry={props.row.original} fieldName={field.name} />;
            } else {
                return <div>{props.getValue() as string}</div>;
            }
        };
        const column: ColumnDef<PeerStats> = {
            header: t(field.label),
            accessorKey: field.name,
            id: field.columnId,
            accessorFn: field.accessorFn,
            cell,
        };
        return column;
    });
}

function useTranslatedPeersColumns() {
    const { t } = useTranslation();
    return useMemo(() => createPeersColumns((key) => t(key as any)), [t]);
}

export function PeersTable(props: { torrent: Torrent }) {
    const getRowId = useCallback((t: PeerStats) => `${t.address as string}:${t.port as number}`, []);

    const columns = useTranslatedPeersColumns();
    const [selected, selectedReducer] = useStandardSelect();

    return <TrguiTable<PeerStats> {...{
        tablename: "peers",
        columns,
        data: props.torrent.peers,
        selected,
        getRowId,
        selectedReducer,
    }} />;
}
