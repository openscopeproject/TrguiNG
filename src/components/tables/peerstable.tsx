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

import { useTranslation } from "react-i18next";
import type { AccessorFn, CellContext, ColumnDef } from "@tanstack/react-table";
import React, { useMemo, useContext } from "react";
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
    labelKey: string,
    columnId?: string,
    accessorFn?: AccessorFn<PeerStats>,
    component?: React.FunctionComponent<TableFieldProps>,
}

const AllFields: TableField[] = [
    { name: "address", labelKey: "tables.peers.address" },
    { name: "port", labelKey: "tables.peers.port" },
    { name: "clientName", labelKey: "tables.peers.client" },
    { name: "flagStr", labelKey: "tables.peers.flags" },
    { name: "progress", labelKey: "tables.peers.have", component: PercentField },
    { name: "rateToPeer", labelKey: "tables.peers.up_speed", component: ByteRateField },
    { name: "rateToClient", labelKey: "tables.peers.down_speed", component: ByteRateField },
    { name: "cachedEncrypted", labelKey: "tables.peers.encrypted", component: PeerValueField },
    { name: "cachedFrom", labelKey: "tables.peers.from" },
    { name: "cachedConnection", labelKey: "tables.peers.connection", component: PeerValueField },
    { name: "cachedProtocol", labelKey: "tables.peers.protocol" },
    { name: "cachedStatus", labelKey: "tables.peers.status", component: PeerValueField },
];

if (TAURI) AllFields.splice(1, 0, { name: "cachedCountryName", labelKey: "tables.peers.country", columnId: "country", component: CountryField });

const peerValueKeys: Record<string, string> = {
    yes: "yes",
    no: "no",
    incoming: "incoming",
    outgoing: "outgoing",
    optimistic: "optimistic",
    downloading: "downloading",
    "can download from": "canDownload",
    uploading: "uploading",
    "can upload to": "canUpload",
    "not interested": "notInterested",
    "peer not interested": "peerNotInterested",
};

function PeerValueField(props: TableFieldProps) {
    const { t } = useTranslation();
    const value = props.entry[props.fieldName] as string;
    const labels = value.split(", ").map((part) => {
        const key = peerValueKeys[part];
        return key === undefined ? part : t(`tables.peers.values.${key}`);
    });
    return <div>{labels.join(", ")}</div>;
}

function CountryField(props: TableFieldProps) {
    const { i18n } = useTranslation();
    const iso = props.entry.cachedCountryIso;
    const countryName = useMemo(() => {
        if (iso === undefined || !/^[a-z]{2}$/i.test(iso)) return props.entry.cachedCountryName;
        return new Intl.DisplayNames([i18n.resolvedLanguage ?? "en"], { type: "region" }).of(iso.toUpperCase())
            ?? props.entry.cachedCountryName;
    }, [iso, i18n.resolvedLanguage, props.entry.cachedCountryName]);
    return <Flex gap="sm" style={{ width: "100%" }}>
        {iso !== undefined && <span className={`fi fi-${iso.toLowerCase()}`} style={{ flexShrink: 0 }} />}
        <span>{countryName}</span>
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

function buildColumns(t: (key: string) => string) {
    return AllFields.map((field): ColumnDef<PeerStats> => {
        const cell = (props: CellContext<PeerStats, unknown>) => {
            if (field.component !== undefined) {
                return <field.component entry={props.row.original} fieldName={field.name} />;
            } else {
                return <div>{props.getValue() as string}</div>;
            }
        };
        const column: ColumnDef<PeerStats> = {
            header: t(field.labelKey),
            accessorKey: field.name,
            id: field.columnId,
            accessorFn: field.accessorFn,
            cell,
        };
        return column;
    });
}

function getRowId(peer: PeerStats) {
    return peer.peer_id !== undefined ? peer.peer_id : `${peer.address as string}:${peer.port as number}`;
}

export function PeersTable(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const columns = useMemo(() => buildColumns(t), [t]);
    const [selected, selectedReducer] = useStandardSelect();

    return <TrguiTable<PeerStats> {...{
        tablename: "peers",
        columns,
        data: props.torrent.peers,
        selected,
        getRowId,
        selectedReducer,
    }}
    />;
}
