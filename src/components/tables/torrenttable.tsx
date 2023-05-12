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

import "css/torrenttable.css";
import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type Torrent, type TrackerStats, getTorrentError } from "rpc/torrent";
import { PriorityColors, PriorityStrings, Status, StatusStrings, type TorrentAllFieldsType, type TorrentFieldsType, TorrentMinimumFields } from "rpc/transmission";
import { type ColumnDef, type VisibilityState } from "@tanstack/react-table";
import { bytesToHumanReadableStr, secondsToHumanReadableStr, timestampToDateString } from "util";
import { ProgressBar } from "../progressbar";
import { type AccessorFn, type CellContext } from "@tanstack/table-core";
import { TransguiTable } from "./common";
import { getTrackerAnnounceState } from "./trackertable";
import { ActionIcon, Badge, Box, TextInput } from "@mantine/core";
import { ConfigContext } from "config";
import { StatusIconMap, Error as StatusIconError } from "components/statusicons";
import * as Icon from "react-bootstrap-icons";

interface TableFieldProps {
    torrent: Torrent,
    fieldName: TorrentAllFieldsType,
}

interface TableFieldSimple {
    name: TorrentFieldsType,
    label: string,
    component: React.FunctionComponent<TableFieldProps> | React.NamedExoticComponent<TableFieldProps>,
    requiredFields?: TorrentFieldsType[],
}

interface TableFieldWithAccessor extends TableFieldSimple {
    columnId: string,
    accessorFn: AccessorFn<Torrent>,
}

type TableField = TableFieldSimple | TableFieldWithAccessor;

function isTableFieldWithAccessor(f: TableField): f is TableFieldWithAccessor {
    return (f as TableFieldWithAccessor).accessorFn !== undefined;
}

const TimeField = memo(function TimeField(props: TableFieldProps) {
    if (props.fieldName in props.torrent) {
        return <>{secondsToHumanReadableStr(props.torrent[props.fieldName])}</>;
    } else {
        return <></>;
    }
}, (prev, next) => {
    const previousValue = prev.torrent[prev.fieldName] as number;
    const nextValue = next.torrent[next.fieldName] as number;
    return Math.abs((previousValue - nextValue) / nextValue) < 1 / 60 / 60;
});

const AllFields: readonly TableField[] = [
    {
        name: "name",
        label: "Name",
        component: NameField,
        requiredFields: ["name", "error", "trackerStats"] as TorrentFieldsType[],
    },
    { name: "totalSize", label: "Size", component: ByteSizeField },
    { name: "sizeWhenDone", label: "Size to download", component: ByteSizeField },
    { name: "leftUntilDone", label: "Size left", component: ByteSizeField },
    { name: "haveValid", label: "Downloaded", component: ByteSizeField },
    {
        name: "percentDone",
        label: "Done",
        component: PercentBarField,
        requiredFields: ["percentDone", "rateDownload", "rateUpload"] as TorrentFieldsType[],
    },
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
        name: "trackerStats",
        label: "Tracker status",
        component: TrackerStatusField,
        columnId: "trackerStatus",
        accessorFn: getTrackerStatus,
    },
    { name: "doneDate", label: "Completed on", component: DateField },
    { name: "activityDate", label: "Last active", component: DateField },
    { name: "downloadDir", label: "Path", component: StringField },
    { name: "bandwidthPriority", label: "Priority", component: PriorityField },
    { name: "id", label: "ID", component: StringField },
    { name: "queuePosition", label: "Queue position", component: StringField },
    { name: "secondsSeeding", label: "Seeding time", component: TimeField },
    { name: "isPrivate", label: "Private", component: StringField },
    { name: "labels", label: "Labels", component: LabelsField },
    { name: "group", label: "Bandwidth group", component: StringField },
] as const;

function NameField(props: TableFieldProps) {
    const [isHover, setHover] = useState(false);

    let StatusIcon = StatusIconMap[props.torrent.status];
    if ((props.torrent.error !== undefined && props.torrent.error > 0) ||
        getTorrentError(props.torrent) !== "") {
        StatusIcon = StatusIconError;
    }

    const currentName = useMemo(() => props.torrent[props.fieldName], [props.fieldName, props.torrent]);
    const textRef = useRef<HTMLInputElement>(null);

    const [newName, setNewName] = useState("");
    const [isRenaming, setRenaming] = useState(false);

    const renameHandler = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setRenaming(true);
        setNewName(currentName);
    }, [currentName]);

    useEffect(() => {
        if (isRenaming && textRef.current != null) {
            textRef.current.focus();
            textRef.current.select();
        }
    }, [isRenaming]);

    // TODO need client in context manager
    // const mutation = useMutateTorrent(client);

    const updateTorrentName = useCallback((name: string) => {
        // TODO
        // mutation.mutate(...)
        setRenaming(false);
    }, []);

    return (
        <Box onMouseEnter={() => { setHover(true); }} onMouseLeave={() => { setHover(false); }}
            sx={{ display: "flex", alignItems: "center", width: "100%" }}>
            <Box pb="xs" sx={{ flexShrink: 0 }}>
                <StatusIcon />
            </Box>
            {isRenaming
                ? <TextInput ref={textRef} value={newName} sx={{ flexGrow: 1, height: "100%" }}
                    styles={{
                        input: {
                            height: "1.5rem",
                            minHeight: "1.5rem",
                            lineHeight: "1.3rem",
                        }
                    }}
                    onChange={(e) => { setNewName(e.target.value); }}
                    onBlur={() => { setRenaming(false); }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            updateTorrentName(newName);
                        }
                    }} />
                : <Box pl="xs" sx={{ flexGrow: 1, textOverflow: "ellipsis", overflow: "hidden" }}>
                    {currentName}
                </Box>}
            {isHover && !isRenaming
                ? <ActionIcon sx={{ flexShrink: 0 }} onClick={renameHandler}>
                    <Icon.InputCursorText size="1rem" />
                </ActionIcon>
                : <></>}
        </Box>
    );
}

function StringField(props: TableFieldProps) {
    return <>
        {props.torrent[props.fieldName]}
    </>;
}

export function EtaField(props: TableFieldProps) {
    const seconds = props.torrent[props.fieldName];
    if (seconds >= 0) return <TimeField {...props} />;
    else if (seconds === -1) return <></>;
    else return <>Unknown</>;
}

export function TrackerField(props: TableFieldProps) {
    const trackers = props.torrent.trackerStats;
    return <>{trackers.length > 0 ? trackers[0].host : "No tracker"}</>;
}

function getTrackerStatus(torrent: Torrent): string {
    const trackers = torrent.trackerStats as TrackerStats[];
    if (torrent.status === Status.stopped || trackers.length === 0) return "";
    return getTrackerAnnounceState(trackers[0]);
}

function TrackerStatusField(props: TableFieldProps) {
    return <>{getTrackerStatus(props.torrent)}</>;
}

function PriorityField(props: TableFieldProps) {
    const priority = props.torrent[props.fieldName];
    return <Badge radius="md" variant="filled" bg={PriorityColors.get(priority)}>{PriorityStrings.get(priority)}</Badge>;
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
    const date = props.torrent[props.fieldName] > 0
        ? timestampToDateString(props.torrent[props.fieldName])
        : "";
    return <>{date}</>;
}

function ByteSizeField(props: TableFieldProps) {
    const field = props.torrent[props.fieldName];
    const stringValue = useMemo(() => {
        return bytesToHumanReadableStr(field);
    }, [field]);

    return <div style={{ textAlign: "right" }}>{stringValue}</div>;
}

function ByteRateField(props: TableFieldProps) {
    const field = props.torrent[props.fieldName];
    const stringValue = useMemo(() => {
        return `${bytesToHumanReadableStr(field)}/s`;
    }, [field]);

    return <div style={{ textAlign: "right" }}>{stringValue}</div>;
}

function PercentBarField(props: TableFieldProps) {
    const now = props.torrent[props.fieldName] * 100;
    const active = props.torrent.rateDownload > 0 || props.torrent.rateUpload > 0;

    return <ProgressBar
        now={now}
        className="white-outline"
        animate={active} />;
}

const Columns = AllFields.map((f): ColumnDef<Torrent> => {
    const cell = (props: CellContext<Torrent, unknown>) => {
        return <f.component fieldName={f.name} torrent={props.row.original} />;
    };
    if (isTableFieldWithAccessor(f)) {
        return {
            header: f.label,
            accessorFn: f.accessorFn,
            id: f.columnId,
            cell,
        };
    }
    return {
        header: f.label,
        accessorKey: f.name,
        cell,
    };
});

const ColumnRequiredFields = AllFields.map(
    (f) => ({
        id: (f as TableFieldWithAccessor).columnId ?? f.name,
        requires: f.requiredFields ?? [f.name]
    })
);

function getRequiredFields(visibilityState: VisibilityState): TorrentFieldsType[] {
    const set = ColumnRequiredFields.reduce(
        (set: Set<TorrentFieldsType>, f) => {
            if (!(f.id in visibilityState) || visibilityState[f.id]) {
                f.requires.forEach((r) => set.add(r));
            }
            return set;
        },
        new Set<TorrentFieldsType>());

    // add bare minimum fields
    TorrentMinimumFields.forEach((f) => set.add(f));

    return Array.from(set).sort();
}

export function useInitialTorrentRequiredFields() {
    const config = useContext(ConfigContext);

    return useMemo(
        () => getRequiredFields(config.getTableColumnVisibility("torrents")),
        [config]);
}

export function TorrentTable(props: {
    torrents: Torrent[],
    setCurrentTorrent: (id: string) => void,
    selectedTorrents: Set<number>,
    selectedReducer: React.Dispatch<{ verb: string, ids: string[] }>,
    onColumnVisibilityChange: React.Dispatch<TorrentFieldsType[]>,
}) {
    const getRowId = useCallback((t: Torrent) => String(t.id), []);
    const selected = useMemo(
        () => Array.from(props.selectedTorrents).map(String), [props.selectedTorrents]);

    const { onColumnVisibilityChange } = props;
    const onVisibilityChange = useCallback(
        (visibility: VisibilityState) => { onColumnVisibilityChange(getRequiredFields(visibility)); },
        [onColumnVisibilityChange]
    );

    return <TransguiTable<Torrent> {...{
        tablename: "torrents",
        columns: Columns,
        data: props.torrents,
        selected,
        getRowId,
        selectedReducer: props.selectedReducer,
        setCurrent: props.setCurrentTorrent,
        onVisibilityChange,
    }} />;
}
