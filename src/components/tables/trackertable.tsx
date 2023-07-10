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
import React, { useCallback } from "react";
import type { Torrent, TrackerStats } from "rpc/torrent";
import { getTrackerAnnounceState } from "rpc/torrent";
import type { TrackerStatsFieldsType } from "rpc/transmission";
import { secondsToHumanReadableStr } from "trutil";
import { TrguiTable, useStandardSelect } from "./common";

interface TableFieldProps {
    entry: TrackerStats,
    fieldName: TrackerStatsFieldsType,
}

interface TableField {
    name: TrackerStatsFieldsType,
    label: string,
    columnId?: string,
    accessorFn?: AccessorFn<TrackerStats>,
    component?: React.FunctionComponent<TableFieldProps>,
}

const AllFields: readonly TableField[] = [
    { name: "announce", label: "Announce URL" },
    { name: "announceState", label: "Status", columnId: "status", accessorFn: getTrackerAnnounceState },
    { name: "nextAnnounceTime", label: "Next update", component: NextUpdateField },
    { name: "seederCount", label: "Seeds", component: NumberField },
    { name: "leecherCount", label: "Peers", component: NumberField },
    { name: "downloadCount", label: "Downloads", component: NumberField },
] as const;

const Columns = AllFields.map((field): ColumnDef<TrackerStats> => {
    const cell = (props: CellContext<TrackerStats, unknown>) => {
        if (field.component !== undefined) {
            return <field.component entry={props.row.original} fieldName={field.name} />;
        } else {
            return <div>{props.getValue() as string}</div>;
        }
    };
    return {
        header: field.label,
        accessorKey: field.name,
        accessorFn: field.accessorFn,
        cell,
    };
});

function NextUpdateField(props: TableFieldProps) {
    if (props.entry.announceState !== 1) return <div>-</div>;
    const seconds = props.entry[props.fieldName] - Math.floor(Date.now() / 1000);
    if (seconds > 0) return <div>{secondsToHumanReadableStr(seconds)}</div>;
    return <div>-</div>;
}

function NumberField(props: TableFieldProps) {
    const count = props.entry[props.fieldName] as number;

    return <div style={{ width: "100%", textAlign: "right" }}>{count >= 0 ? count : ""}</div>;
}

export function TrackersTable(props: { torrent: Torrent }) {
    const getRowId = useCallback((t: TrackerStats) => String(t.id), []);

    const [selected, selectedReducer] = useStandardSelect();

    return <TrguiTable<TrackerStats> {...{
        tablename: "trackers",
        columns: Columns,
        data: props.torrent.trackerStats,
        selected,
        getRowId,
        selectedReducer,
    }} />;
}
