import { AccessorFn, CellContext, ColumnDef } from "@tanstack/react-table";
import React from "react";
import { useCallback } from "react";
import { Torrent, TrackerStats } from "rpc/torrent";
import { TrackerStatsFieldsType } from "rpc/transmission";
import { secondsToHumanReadableStr } from "util";
import { Table, useStandardSelect } from "./common";

export function getTrackerAnnounceState(tracker: TrackerStats) {
    if (tracker.announceState == 2 || tracker.announceState == 3) return "Working";
    if (tracker.hasAnnounced) {
        if (tracker.lastAnnounceSucceeded) return "Working";
        if (tracker.lastAnnounceResult == "Success") return "Working";
        return tracker.lastAnnounceResult;
    }
    return "";
}

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
    { name: "seederCount", label: "Seeds" },
    { name: "leecherCount", label: "Peers" },
] as const;

const Columns = AllFields.map((field): ColumnDef<TrackerStats> => {
    const cell = (props: CellContext<TrackerStats, unknown>) => {
        if(field.component)
            return <field.component entry={props.row.original} fieldName={field.name} />;
        else
            return <>{props.getValue()}</>;
    }
    let column: ColumnDef<TrackerStats> = {
        header: field.label,
        accessorKey: field.name,
        accessorFn: field.accessorFn,
        cell
    }
    return column;
})

function NextUpdateField(props: TableFieldProps) {
    if(props.entry.announceState != 1) return <>-</>;
    let seconds = props.entry[props.fieldName] - Math.floor(Date.now() / 1000);
    if (seconds > 0)
        return <>{secondsToHumanReadableStr(seconds)}</>;
    return <>-</>;
}

export function TrackersTable(props: { torrent: Torrent }) {

    const getRowId = useCallback((t: TrackerStats) => String(t.id), []);

    const [, selectedReducer, data] = useStandardSelect(
        props.torrent.trackerStats as TrackerStats[], getRowId);

    return <Table<TrackerStats> {...{
        tablename: "trackers",
        columns: Columns,
        data,
        getRowId,
        selectedReducer
    }} />;
}
