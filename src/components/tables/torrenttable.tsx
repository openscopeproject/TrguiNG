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

import "css/torrenttable.css";
import React, { memo, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ServerTorrentData, Torrent, TrackerStats } from "rpc/torrent";
import { getTorrentError, getTorrentMainTracker, getTrackerStatus } from "rpc/torrent";
import type { TorrentAllFieldsType, TorrentFieldsType } from "rpc/transmission";
import { PriorityColors, PriorityStrings, Status, StatusStrings, TorrentMinimumFields } from "rpc/transmission";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { bytesToHumanReadableStr, pathMapFromServer, secondsToHumanReadableStr, timestampToDateString } from "util";
import { ProgressBar } from "../progressbar";
import type { AccessorFn, CellContext } from "@tanstack/table-core";
import type { TableSelectReducer } from "./common";
import { EditableNameField, TransguiTable } from "./common";
import { Badge, Box, Button, Kbd, Menu, Portal, Text } from "@mantine/core";
import { ConfigContext, ServerConfigContext } from "config";
import { StatusIconMap, Error as StatusIconError } from "components/statusicons";
import { useMutateTorrentPath, useTorrentAction } from "queries";
import { notifications } from "@mantine/notifications";
import type { ContextMenuInfo } from "components/contextmenu";
import { ContextMenu, useContextMenu } from "components/contextmenu";
import type { ModalCallbacks } from "components/modals/servermodals";
import type { TorrentActionMethodsType } from "rpc/client";
import * as Icon from "react-bootstrap-icons";
const { TAURI, invoke } = await import(/* webpackChunkName: "taurishim" */"taurishim");

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
        return <div>{secondsToHumanReadableStr(props.torrent[props.fieldName])}</div>;
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
    { name: "haveValid", label: "Have", component: ByteSizeField },
    { name: "downloadedEver", label: "Downloaded", component: ByteSizeField },
    { name: "uploadedEver", label: "Uploaded", component: ByteSizeField },
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
    { name: "peersSendingToUs", label: "Seeds", component: SeedsField },
    { name: "peersGettingFromUs", label: "Peers", component: PeersField },
    { name: "eta", label: "ETA", component: EtaField },
    { name: "uploadRatio", label: "Ratio", component: NumberField },
    {
        name: "trackerStats",
        label: "Tracker",
        component: TrackerField,
        columnId: "tracker",
        accessorFn: getTorrentMainTracker,
    },
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
    let StatusIcon = StatusIconMap[props.torrent.status];
    if ((props.torrent.error !== undefined && props.torrent.error > 0) ||
        getTorrentError(props.torrent) !== "") {
        StatusIcon = StatusIconError;
    }

    const currentName = useMemo(() => props.torrent[props.fieldName], [props.fieldName, props.torrent]);

    const mutation = useMutateTorrentPath();

    const updateTorrentName = useCallback((name: string, onStart: () => void, onEnd: () => void) => {
        onStart();

        mutation.mutate(
            { torrentId: props.torrent.id, path: props.torrent.name, name },
            {
                onSettled: onEnd,
                onError: () => { notifications.show({ color: "red", message: "Failed to rename torrent" }); },
            });
    }, [mutation, props.torrent.id, props.torrent.name]);

    return (
        <EditableNameField currentName={currentName} onUpdate={updateTorrentName}>
            <Box pb="xs" sx={{ flexShrink: 0 }}>
                <StatusIcon />
            </Box>
        </EditableNameField>
    );
}

function StringField(props: TableFieldProps) {
    return (
        <div>
            {props.torrent[props.fieldName]}
        </div>
    );
}

function NumberField(props: TableFieldProps) {
    return (
        <div style={{ width: "100%", textAlign: "right" }}>
            {props.torrent[props.fieldName]}
        </div>
    );
}

function SeedsField(props: TableFieldProps) {
    const sending = props.torrent.peersSendingToUs as number;
    let totalSeeds = props.torrent.trackerStats.length > 0 ? 0 : -1;
    props.torrent.trackerStats.forEach(
        (tracker: TrackerStats) => { totalSeeds += Math.max(0, tracker.seederCount as number); });
    return (
        <div style={{ width: "100%", textAlign: "right" }}>
            {totalSeeds < 0 ? `${sending}` : `${sending} / ${totalSeeds}`}
        </div>
    );
}

function PeersField(props: TableFieldProps) {
    const getting = props.torrent.peersGettingFromUs as number;
    let totalLeechers = props.torrent.trackerStats.length > 0 ? 0 : -1;
    props.torrent.trackerStats.forEach(
        (tracker: TrackerStats) => { totalLeechers += Math.max(0, tracker.leecherCount as number); });
    return (
        <div style={{ width: "100%", textAlign: "right" }}>
            {totalLeechers < 0 ? `${getting}` : `${getting} / ${totalLeechers}`}
        </div>
    );
}

export function EtaField(props: TableFieldProps) {
    const seconds = props.torrent[props.fieldName];
    if (seconds >= 0) return <TimeField {...props} />;
    else if (seconds === -1) return <></>;
    else return <div>Unknown</div>;
}

export function TrackerField(props: TableFieldProps) {
    return <div>{getTorrentMainTracker(props.torrent)}</div>;
}

function TrackerStatusField(props: TableFieldProps) {
    return <div>{getTrackerStatus(props.torrent)}</div>;
}

function PriorityField(props: TableFieldProps) {
    const priority = props.torrent[props.fieldName];
    return <Badge radius="md" variant="filled" bg={PriorityColors.get(priority)}>{PriorityStrings.get(priority)}</Badge>;
}

export function LabelsField(props: TableFieldProps) {
    const labels: string[] | undefined = props.torrent.labels;
    return <>
        {labels?.map((label) => <Badge key={label}
            radius="md" variant="filled" className="torrent-label white-outline">
            {label}
        </Badge>)}
    </>;
}

export function StatusField(props: TableFieldProps) {
    const status = StatusStrings[props.torrent.status];
    const sequential = (props.torrent.status === Status.downloading && props.torrent.sequentialDownload === true) ? " sequentially" : "";
    return <div>{(status as string) + sequential}</div>;
}

export function DateField(props: TableFieldProps) {
    const date = props.torrent[props.fieldName] > 0
        ? timestampToDateString(props.torrent[props.fieldName])
        : "";
    return <div>{date}</div>;
}

function ByteSizeField(props: TableFieldProps) {
    const field = props.torrent[props.fieldName];
    const stringValue = useMemo(() => {
        return bytesToHumanReadableStr(field);
    }, [field]);

    return <div style={{ width: "100%", textAlign: "right" }}>{stringValue}</div>;
}

function ByteRateField(props: TableFieldProps) {
    const field = props.torrent[props.fieldName];
    const stringValue = useMemo(() => {
        return `${bytesToHumanReadableStr(field)}/s`;
    }, [field]);

    return <div style={{ width: "100%", textAlign: "right" }}>{stringValue}</div>;
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
        requires: f.requiredFields ?? [f.name],
    }),
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
    if (TAURI) set.add("hashString");

    return Array.from(set).sort();
}

export function useInitialTorrentRequiredFields() {
    const config = useContext(ConfigContext);

    return useMemo(
        () => getRequiredFields(config.getTableColumnVisibility("torrents")),
        [config]);
}

export function TorrentTable(props: {
    serverData: React.MutableRefObject<ServerTorrentData>,
    modals: React.RefObject<ModalCallbacks>,
    torrents: Torrent[],
    setCurrentTorrent: (id: string) => void,
    selectedTorrents: Set<number>,
    selectedReducer: TableSelectReducer,
    onColumnVisibilityChange: React.Dispatch<TorrentFieldsType[]>,
    scrollToRow?: { id: string },
}) {
    const serverConfig = useContext(ServerConfigContext);

    const getRowId = useCallback((t: Torrent) => String(t.id), []);
    const selected = useMemo(
        () => Array.from(props.selectedTorrents).map(String), [props.selectedTorrents]);

    const { onColumnVisibilityChange } = props;
    const onVisibilityChange = useCallback(
        (visibility: VisibilityState) => { onColumnVisibilityChange(getRequiredFields(visibility)); },
        [onColumnVisibilityChange],
    );

    const onRowDoubleClick = useCallback((torrent: Torrent) => {
        if (torrent.downloadDir === undefined || torrent.downloadDir === "") return;
        let path = torrent.downloadDir as string;
        if (!path.endsWith("/") && !path.endsWith("\\")) {
            path = path + "/";
        }
        path = path + (torrent.name as string);
        path = pathMapFromServer(path, serverConfig);
        invoke("shell_open", { path }).catch((e) => {
            notifications.show({
                title: "Error opening path",
                message: path,
                color: "red",
            });
        });
    }, [serverConfig]);

    const [info, setInfo, handler] = useContextMenu();

    return (
        <Box w="100%" h="100%" onContextMenu={handler}>
            <MemoizedTorrentContextMenu
                contextMenuInfo={info}
                setContextMenuInfo={setInfo}
                serverData={props.serverData}
                selected={selected}
                modals={props.modals}
                onRowDoubleClick={onRowDoubleClick} />
            <TransguiTable<Torrent> {...{
                tablename: "torrents",
                columns: Columns,
                data: props.torrents,
                selected,
                getRowId,
                selectedReducer: props.selectedReducer,
                setCurrent: props.setCurrentTorrent,
                onVisibilityChange,
                onRowDoubleClick,
                scrollToRow: props.scrollToRow,
            }} />
        </Box>
    );
}

const findTorrent = (serverData: React.MutableRefObject<ServerTorrentData>) => {
    const [id] = [...serverData.current.selected];
    return serverData.current.torrents.find((t) => t.id === id);
};

function TorrentContextMenu(props: {
    contextMenuInfo: ContextMenuInfo,
    setContextMenuInfo: (i: ContextMenuInfo) => void,
    serverData: React.MutableRefObject<ServerTorrentData>,
    selected: string[],
    modals: React.RefObject<ModalCallbacks>,
    onRowDoubleClick: (t: Torrent) => void,
}) {
    const { onRowDoubleClick } = props;
    const onOpen = useCallback(() => {
        const torrent = findTorrent(props.serverData);
        if (torrent === undefined) return;
        onRowDoubleClick(torrent);
    }, [onRowDoubleClick, props.serverData]);

    const mutation = useTorrentAction();

    const torrentAction = useCallback((method: TorrentActionMethodsType, successMessage: string) => {
        mutation.mutate(
            {
                method,
                torrentIds: Array.from(props.serverData.current.selected),
            },
            {
                onSuccess: () => {
                    notifications.show({
                        message: successMessage,
                        color: "green",
                    });
                },
            },
        );
    }, [mutation, props.serverData]);

    const [queueSubmenuOpened, setQueueSubmenuOpened] = useState(false);
    const queueRef = useRef<HTMLButtonElement>(null);
    const [queueItemRect, setQueueItemRect] = useState<DOMRect>(() => new DOMRect(0, 0, 0, 0));

    const openQueueSubmenu = useCallback(() => {
        if (queueRef.current == null || props.selected.length === 0) return;
        setQueueItemRect(queueRef.current.getBoundingClientRect());
        setQueueSubmenuOpened(true);
    }, [props.selected]);

    return (<>
        <Menu
            openDelay={100}
            closeDelay={400}
            opened={queueSubmenuOpened}
            onChange={setQueueSubmenuOpened}
            middlewares={{ shift: true, flip: true }}
            position="right-start"
            zIndex={301}
        >
            <Portal>
                <Box
                    onMouseDown={() => { setQueueSubmenuOpened(false); }}
                    sx={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: "100vh",
                        width: "100vw",
                        zIndex: queueSubmenuOpened ? 100 : -1,
                    }} />
                <Menu.Target>
                    <Button unstyled
                        sx={{
                            position: "absolute",
                            border: 0,
                            padding: 0,
                            background: "transparent",
                        }}
                        style={{
                            left: queueItemRect.x,
                            top: queueItemRect.y,
                            width: `calc(${queueItemRect.width}px + 0.5em)`,
                            height: queueItemRect.height,
                        }} />
                </Menu.Target>
                <Menu.Dropdown miw="10rem">
                    <Menu.Item
                        onClick={() => { torrentAction("queue-move-top", "Torrents queue updated"); }}
                        icon={<Icon.ChevronDoubleUp size="1.1rem" />}>
                        Move to top
                    </Menu.Item>
                    <Menu.Item
                        onClick={() => { torrentAction("queue-move-up", "Torrents queue updated"); }}
                        icon={<Icon.ChevronUp size="1.1rem" />}>
                        Move up
                    </Menu.Item>
                    <Menu.Item
                        onClick={() => { torrentAction("queue-move-down", "Torrents queue updated"); }}
                        icon={<Icon.ChevronDown size="1.1rem" />}>
                        Move down
                    </Menu.Item>
                    <Menu.Item
                        onClick={() => { torrentAction("queue-move-bottom", "Torrents queue updated"); }}
                        icon={<Icon.ChevronDoubleDown size="1.1rem" />}>
                        Move to bottom
                    </Menu.Item>
                </Menu.Dropdown>
            </Portal>
        </Menu>
        <ContextMenu contextMenuInfo={props.contextMenuInfo} setContextMenuInfo={props.setContextMenuInfo}>
            <Box miw="10rem">
                {TAURI && <>
                    <Menu.Item
                        onClick={onOpen}
                        onMouseEnter={() => { setQueueSubmenuOpened(false); }}
                        icon={<Icon.BoxArrowUpRight size="1.1rem" />}
                        disabled={props.selected.length !== 1}>
                        <Text weight="bold">Open</Text>
                    </Menu.Item>
                    <Menu.Divider />
                </>}
                <Menu.Item
                    onClick={() => { torrentAction("torrent-start-now", "Torrents started"); }}
                    onMouseEnter={() => { setQueueSubmenuOpened(false); }}
                    icon={<Icon.LightningFill size="1.1rem" />}
                    disabled={props.selected.length === 0}>
                    Force start
                </Menu.Item>
                <Menu.Item
                    onClick={() => { torrentAction("torrent-verify", "Torrents verification started"); }}
                    onMouseEnter={() => { setQueueSubmenuOpened(false); }}
                    icon={<Icon.CheckAll size="1.1rem" />}
                    disabled={props.selected.length === 0}>
                    Verify
                </Menu.Item>
                <Menu.Item
                    onClick={() => { torrentAction("torrent-reannounce", "Torrents are reannounced"); }}
                    onMouseEnter={() => { setQueueSubmenuOpened(false); }}
                    icon={<Icon.Wifi size="1.1rem" />}
                    disabled={props.selected.length === 0}>
                    Reannounce
                </Menu.Item>
                <Menu.Item ref={queueRef}
                    icon={<Icon.ThreeDots size="1.1rem" />}
                    rightSection={<Icon.ChevronRight size="0.8rem" />}
                    onMouseEnter={openQueueSubmenu}
                    disabled={props.selected.length === 0}>
                    Queue
                </Menu.Item>
                <Menu.Item
                    onClick={() => props.modals.current?.move()}
                    onMouseEnter={() => { setQueueSubmenuOpened(false); }}
                    icon={<Icon.FolderFill size="1.1rem" />}
                    disabled={props.selected.length === 0}
                    rightSection={<Kbd>F6</Kbd>}>
                    Move...
                </Menu.Item>
                <Menu.Item
                    onClick={() => props.modals.current?.setLabels()}
                    onMouseEnter={() => { setQueueSubmenuOpened(false); }}
                    icon={<Icon.TagsFill size="1.1rem" />}
                    disabled={props.selected.length === 0}
                    rightSection={<Kbd>F7</Kbd>}>
                    Set labels...
                </Menu.Item>
                <Menu.Item
                    onClick={() => props.modals.current?.remove()}
                    onMouseEnter={() => { setQueueSubmenuOpened(false); }}
                    icon={<Icon.XCircleFill color="red" size="1.1rem" />}
                    disabled={props.selected.length === 0}
                    rightSection={<Kbd>del</Kbd>}>
                    Remove...
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                    onClick={() => props.modals.current?.editTorrent()}
                    icon={<Icon.GearFill size="1.1rem" />}
                    onMouseEnter={() => { setQueueSubmenuOpened(false); }}
                    disabled={props.selected.length !== 1}>
                    Properties...
                </Menu.Item>
            </Box>
        </ContextMenu>
    </>);
}

const MemoizedTorrentContextMenu = memo(TorrentContextMenu);
