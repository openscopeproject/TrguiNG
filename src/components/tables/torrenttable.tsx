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

import 'css/torrenttable.css';
import React, { memo, useCallback, useMemo } from 'react';
import { Torrent, TrackerStats } from 'rpc/torrent';
import { PriorityColors, PriorityStrings, Status, StatusStrings, TorrentAllFieldsType, TorrentFieldsType } from 'rpc/transmission';
import { ColumnDef } from '@tanstack/react-table';
import { bytesToHumanReadableStr, secondsToHumanReadableStr, timestampToDateString } from 'util';
import { ProgressBar } from '../progressbar';
import { AccessorFn, CellContext } from '@tanstack/table-core';
import { Table } from "./common";
import { getTrackerAnnounceState } from "./trackertable";
import { Badge } from "@mantine/core";

interface TableFieldProps {
    torrent: Torrent,
    fieldName: TorrentAllFieldsType,
}

interface TableField {
    name: TorrentFieldsType,
    label: string,
    component: React.FunctionComponent<TableFieldProps> | React.NamedExoticComponent<TableFieldProps>,
    columnId?: string,
    accessorFn?: AccessorFn<Torrent>,
}

const TimeField = memo(function TimeField(props: TableFieldProps) {
    return <>{secondsToHumanReadableStr(props.torrent[props.fieldName])}</>;
}, (prev, next) => {
    let previousValue = prev.torrent[prev.fieldName] as number;
    let nextValue = next.torrent[next.fieldName] as number;
    return Math.abs((previousValue - nextValue) / nextValue) < 1 / 60 / 60;
});

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
    var trackers = torrent.trackerStats as TrackerStats[];
    if (torrent.status == Status.stopped || trackers.length == 0) return "";
    return getTrackerAnnounceState(trackers[0]);
}

function TrackerStatusField(props: TableFieldProps) {
    return <>{getTrackerStatus(props.torrent)}</>;
}

function PriorityField(props: TableFieldProps) {
    const priority = props.torrent[props.fieldName];
    return <Badge radius="md" variant="filled" bg={PriorityColors.get(priority)!}>{PriorityStrings.get(priority)}</Badge>;
}

export function LabelsField(props: TableFieldProps) {
    const labels: string[] = props.torrent.labels;
    return <>
        {labels.map((label) => <Badge key={label} radius="md" variant="filled" className="torrent-label white-outline">{label}</Badge>)}
    </>;
}

export function StatusField(props: TableFieldProps) {
    const status = StatusStrings[props.torrent.status];
    return <>{status}</>;
}

export function DateField(props: TableFieldProps) {
    const date = props.torrent[props.fieldName] > 0 ?
        timestampToDateString(props.torrent[props.fieldName]) : "";
    return <>{date}</>;
}

function ByteSizeField(props: TableFieldProps) {
    const stringValue = useMemo(() => {
        return bytesToHumanReadableStr(props.torrent[props.fieldName]);
    }, [props.torrent[props.fieldName]]);

    return <>{stringValue}</>;
}

function ByteRateField(props: TableFieldProps) {
    const stringValue = useMemo(() => {
        return `${bytesToHumanReadableStr(props.torrent[props.fieldName])}/s`;
    }, [props.torrent[props.fieldName]]);

    return <>{stringValue}</>;
}

function PercentBarField(props: TableFieldProps) {
    const now = props.torrent[props.fieldName] * 100;
    const active = props.torrent.rateDownload > 0 || props.torrent.rateUpload > 0;

    return <ProgressBar
        now={now}
        className="white-outline"
        animate={active}
    />
}

const Columns = AllFields.map((f): ColumnDef<Torrent> => {
    const cell = (props: CellContext<Torrent, unknown>) => {
        return <f.component fieldName={f.name} torrent={props.row.original} />
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

export function TorrentTable(props: {
    torrents: Torrent[];
    setCurrentTorrent: (id: string) => void;
    selectedTorrents: Set<number>,
    selectedReducer: React.Dispatch<{ verb: string; ids: string[]; }>
}) {
    const getRowId = useCallback((t: Torrent) => String(t.id), []);
    const selected = useMemo(
        () => Array.from(props.selectedTorrents).map(String), [props.selectedTorrents]);

    return <Table<Torrent> {...{
        tablename: "torrents",
        columns: Columns,
        data: props.torrents,
        selected,
        getRowId,
        selectedReducer: props.selectedReducer,
        setCurrent: props.setCurrentTorrent
    }} />;
}
