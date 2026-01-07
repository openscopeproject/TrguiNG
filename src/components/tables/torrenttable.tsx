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
import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Torrent } from "rpc/torrent";
import { useServerTorrentData, useServerRpcVersion, useServerSelectedTorrents } from "rpc/torrent";
import type { TorrentAllFieldsType, TorrentFieldsType } from "rpc/transmission";
import { PriorityColors, PriorityTranslationKeys, Status, StatusStrings, TorrentMinimumFields } from "rpc/transmission";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { bytesToHumanReadableStr, fileSystemSafeName, modKeyString, pathMapFromServer, secondsToHumanReadableStr, timestampToDateString, torrentProgressbarStyle } from "trutil";
import { ProgressBar } from "../progressbar";
import type { AccessorFn, CellContext } from "@tanstack/table-core";
import type { TableSelectReducer } from "./common";
import { EditableNameField, TrguiTable } from "./common";
import { Badge, Box, Button, Kbd, Menu, Portal, Text, useMantineTheme } from "@mantine/core";
import { ConfigContext, ServerConfigContext } from "config";
import { StatusIconMap, Error as StatusIconError, Magnetizing, CompletedStopped } from "components/statusicons";
import { useMutateTorrentPath, useTorrentAction } from "queries";
import { notifications } from "@mantine/notifications";
import type { ContextMenuInfo } from "components/contextmenu";
import { ContextMenu, useContextMenu } from "components/contextmenu";
import type { ModalCallbacks } from "components/modals/servermodals";
import type { TorrentActionMethodsType } from "rpc/client";
import * as Icon from "react-bootstrap-icons";
import { useHotkeysContext } from "hotkeys";
import { useTranslation } from "i18n";
const { TAURI, invoke, copyToClipboard } = await import(/* webpackChunkName: "taurishim" */"taurishim");

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
        label: "torrent.table.name",
        component: NameField,
        requiredFields: ["name", "error", "trackerStats", "leftUntilDone"] as TorrentFieldsType[],
    },
    { name: "totalSize", label: "torrent.table.size", component: ByteSizeField },
    { name: "sizeWhenDone", label: "torrent.table.sizeToDownload", component: ByteSizeField },
    { name: "leftUntilDone", label: "torrent.table.sizeLeft", component: ByteSizeField },
    { name: "haveValid", label: "torrent.table.have", component: ByteSizeField },
    { name: "downloadedEver", label: "torrent.table.downloaded", component: ByteSizeField },
    { name: "uploadedEver", label: "torrent.table.uploaded", component: ByteSizeField },
    {
        name: "uploadedEver",
        label: "torrent.table.udRatio",
        component: UploadRatioField,
        accessorFn: (t) => t.uploadedEver === 0 ? 0 : t.uploadedEver / t.downloadedEver,
        columnId: "simpleRatio",
        requiredFields: ["uploadedEver", "downloadedEver"] as TorrentFieldsType[],
    },
    {
        name: "percentDone",
        label: "torrent.table.done",
        component: PercentBarField,
        requiredFields: ["percentDone", "rateDownload", "rateUpload"] as TorrentFieldsType[],
    },
    { name: "rateDownload", label: "torrent.table.downSpeed", component: ByteRateField },
    { name: "rateUpload", label: "torrent.table.upSpeed", component: ByteRateField },
    { name: "status", label: "torrent.table.status", component: StatusField },
    { name: "addedDate", label: "torrent.table.addedOn", component: DateField },
    {
        name: "peersSendingToUs",
        label: "torrent.table.seeds",
        component: SeedsField,
        columnId: "peersSendingToUs",
        accessorFn: (t) => t.peersSendingToUs * 1e+6 + t.cachedSeedsTotal,
    },
    {
        name: "peersGettingFromUs",
        label: "torrent.table.peers",
        component: PeersField,
        columnId: "peersGettingFromUs",
        accessorFn: (t) => t.peersGettingFromUs * 1e+6 + t.cachedPeersTotal,
    },
    { name: "eta", label: "torrent.table.eta", component: EtaField },
    { name: "uploadRatio", label: "torrent.table.ratio", component: FixedDecimalField },
    {
        name: "trackerStats",
        label: "torrent.table.tracker",
        component: TrackerField,
        columnId: "tracker",
        accessorFn: (t) => t.cachedMainTracker,
    },
    {
        name: "trackerStats",
        label: "torrent.table.trackerStatus",
        component: TrackerStatusField,
        columnId: "trackerStatus",
        accessorFn: (t) => t.cachedTrackerStatus,
    },
    {
        name: "trackerStats",
        label: "torrent.table.trackerDownloads",
        component: TrackerDownloadsField,
        columnId: "trackerDownloads",
        accessorFn: (t) => t.cachedTrackerDlCount,
    },
    {
        name: "errorString",
        label: "torrent.table.error",
        component: ErrorField,
        columnId: "error",
        accessorFn: (t) => t.cachedError,
    },
    { name: "doneDate", label: "torrent.table.completedOn", component: DateField },
    { name: "activityDate", label: "torrent.table.lastActive", component: DateDiffField },
    { name: "downloadDir", label: "torrent.table.path", component: StringField },
    { name: "bandwidthPriority", label: "torrent.table.priority", component: PriorityField },
    { name: "id", label: "torrent.table.id", component: PositiveNumberField },
    { name: "queuePosition", label: "torrent.table.queuePosition", component: PositiveNumberField },
    { name: "secondsSeeding", label: "torrent.table.seedingTime", component: TimeField },
    { name: "isPrivate", label: "torrent.table.private", component: StringField },
    { name: "labels", label: "torrent.table.labels", component: LabelsField },
    { name: "group", label: "torrent.table.bandwidthGroup", component: StringField },
    { name: "file-count", label: "torrent.table.fileCount", component: PositiveNumberField },
    { name: "pieceCount", label: "torrent.table.pieceCount", component: PositiveNumberField },
    { name: "metadataPercentComplete", label: "torrent.table.metadata", component: PercentBarField },
] as const;

const StatusTranslationKeys: Record<number, string> = {
    [Status.stopped]: "stopped",
    [Status.queuedToVerify]: "queued",
    [Status.verifying]: "verifying",
    [Status.queuedToDownload]: "queuedDownload",
    [Status.downloading]: "downloading",
    [Status.queuedToSeed]: "queuedSeed",
    [Status.seeding]: "seeding",
};

function NameField(props: TableFieldProps) {
    const { t } = useTranslation();
    let StatusIcon = StatusIconMap[props.torrent.status];
    if (props.torrent.status === Status.downloading && props.torrent.pieceCount === 0) {
        StatusIcon = Magnetizing;
    }
    if (props.torrent.status === Status.stopped &&
        props.torrent.sizeWhenDone > 0 &&
        props.torrent.leftUntilDone === 0) {
        StatusIcon = CompletedStopped;
    }

    if ((props.torrent.error !== undefined && props.torrent.error > 0) ||
        props.torrent.cachedError !== "") {
        StatusIcon = StatusIconError;
    }

    const currentName = useMemo(() => props.torrent[props.fieldName], [props.fieldName, props.torrent]);

    const mutation = useMutateTorrentPath();

    const updateTorrentName = useCallback((name: string, onStart: () => void, onEnd: () => void) => {
        onStart();
        const path = fileSystemSafeName(props.torrent.name);
        name = fileSystemSafeName(name);
        if (name === path) {
            onEnd();
        } else {
            mutation.mutate(
                { torrentId: props.torrent.id, path, name },
                {
                    onSettled: onEnd,
                    onError: () => { notifications.show({ color: "red", message: t("errors.torrentRenameFailed") }); },
                });
        }
    }, [mutation, props.torrent.id, props.torrent.name, t]);

    const rpcVersion = useServerRpcVersion();

    return (
        <EditableNameField currentName={currentName} onUpdate={rpcVersion >= 15 ? updateTorrentName : undefined}>
            <Box pb="xs" className="icon-container">
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

function PositiveNumberField(props: TableFieldProps) {
    const num = props.torrent[props.fieldName];
    return (
        <div style={{ width: "100%", textAlign: "right" }}>
            {num < 0 ? "" : num}
        </div>
    );
}

function FixedDecimalField(props: TableFieldProps) {
    const num = props.torrent[props.fieldName];
    return (
        <div style={{ width: "100%", textAlign: "right" }}>
            {num < 0 ? "" : Number(num).toFixed(2)}
        </div>
    );
}

function UploadRatioField(props: TableFieldProps) {
    return (
        <div style={{ width: "100%", textAlign: "right" }}>
            {props.torrent.uploadedEver === 0
                ? "-"
                : props.torrent.downloadedEver === 0
                    ? "∞"
                    : (props.torrent.uploadedEver / props.torrent.downloadedEver).toFixed(2)}
        </div>
    );
}

function SeedsField(props: TableFieldProps) {
    const sending = props.torrent.peersSendingToUs as number;
    const totalSeeds = props.torrent.cachedSeedsTotal;
    return (
        <div style={{ width: "100%", textAlign: "right" }}>
            {totalSeeds < 0 ? `${sending}` : `${sending} / ${totalSeeds}`}
        </div>
    );
}

function PeersField(props: TableFieldProps) {
    const getting = props.torrent.peersGettingFromUs as number;
    const totalPeers = props.torrent.cachedPeersTotal;
    return (
        <div style={{ width: "100%", textAlign: "right" }}>
            {totalPeers < 0 ? `${getting}` : `${getting} / ${totalPeers}`}
        </div>
    );
}

export function EtaField(props: TableFieldProps) {
    const seconds = props.torrent[props.fieldName];
    if (seconds >= 0) return <TimeField {...props} />;
    else if (seconds === -1) return <></>;
    else return <div>∞</div>;
}

export function TrackerField(props: TableFieldProps) {
    return <div>{props.torrent.cachedMainTracker}</div>;
}

function TrackerStatusField(props: TableFieldProps) {
    return <div>{props.torrent.cachedTrackerStatus}</div>;
}

function TrackerDownloadsField(props: TableFieldProps) {
    return <div style={{ width: "100%", textAlign: "right" }}>
        {props.torrent.cachedTrackerDlCount >= 0 ? props.torrent.cachedTrackerDlCount : ""}
    </div>;
}

function ErrorField(props: TableFieldProps) {
    return <div>{props.torrent.cachedError}</div>;
}

function PriorityField(props: TableFieldProps) {
    const { t } = useTranslation();
    const priority = props.torrent[props.fieldName] as import("rpc/transmission").PriorityNumberType;
    const translationKey = PriorityTranslationKeys[priority];
    const label = translationKey !== undefined ? t(translationKey) : t("common.unknown");

    return <Badge radius="md" variant="filled" bg={PriorityColors.get(priority)}>{label}</Badge>;
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
    const { t } = useTranslation();
    const baseKey = (props.torrent.status === Status.downloading && props.torrent.pieceCount === 0)
        ? "magnetizing"
        : StatusTranslationKeys[props.torrent.status];

    const status = baseKey !== undefined
        ? t(`torrent.status.${baseKey}`)
        : StatusStrings[props.torrent.status] ?? t("common.unknown");

    const sequential = (props.torrent.status === Status.downloading && props.torrent.sequentialDownload === true)
        ? ` ${t("torrent.status.sequential")}`
        : "";

    return <div>{status + sequential}</div>;
}

export function DateField(props: TableFieldProps) {
    const config = useContext(ConfigContext);
    const date = props.torrent[props.fieldName] > 0
        ? timestampToDateString(props.torrent[props.fieldName], config)
        : "";
    return <div>{date}</div>;
}

export function DateDiffField(props: TableFieldProps) {
    const config = useContext(ConfigContext);
    const date = props.torrent[props.fieldName] > 0
        ? timestampToDateString(props.torrent[props.fieldName], config)
        : "";
    const seconds = Math.floor(Date.now() / 1000) - props.torrent[props.fieldName];
    return <div title={date} style={{ width: "100%", textAlign: "right" }}>
        {seconds < 30
            ? "now"
            : date === "" ? "" : `${secondsToHumanReadableStr(seconds)} ago`}
    </div>;
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
        return field > 0 ? `${bytesToHumanReadableStr(field)}/s` : "";
    }, [field]);

    return <div style={{ width: "100%", textAlign: "right" }}>{stringValue}</div>;
}

function PercentBarField(props: TableFieldProps) {
    const config = useContext(ConfigContext);
    const now = props.torrent[props.fieldName] * 100;
    const progressbarStyle = torrentProgressbarStyle(props.torrent, config);

    return <ProgressBar
        now={now}
        className="white-outline"
        {...progressbarStyle}
    />;
}

function createColumns(t: (key: string) => string): Array<ColumnDef<Torrent>> {
    return AllFields.map((f): ColumnDef<Torrent> => {
        const cell = (props: CellContext<Torrent, unknown>) => {
            return <f.component fieldName={f.name} torrent={props.row.original} />;
        };
        if (isTableFieldWithAccessor(f)) {
            return {
                header: t(f.label),
                accessorFn: f.accessorFn,
                id: f.columnId,
                cell,
            };
        }
        return {
            header: t(f.label),
            accessorKey: f.name,
            cell,
        };
    });
}

function useTranslatedColumns() {
    const { t } = useTranslation();
    return useMemo(() => createColumns((key) => t(key as any)), [t]);
}

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
    modals: React.RefObject<ModalCallbacks>,
    torrents: Torrent[],
    setCurrentTorrent: (id: string) => void,
    selectedTorrents: Set<number>,
    selectedReducer: TableSelectReducer,
    onColumnVisibilityChange: React.Dispatch<TorrentFieldsType[]>,
    scrollToRow?: { id: string },
}) {
    const { t } = useTranslation();
    const serverConfig = useContext(ServerConfigContext);

    const columns = useTranslatedColumns();

    const getRowId = useCallback((t: Torrent) => String(t.id), []);

    const { onColumnVisibilityChange } = props;
    const onVisibilityChange = useCallback(
        (visibility: VisibilityState) => { onColumnVisibilityChange(getRequiredFields(visibility)); },
        [onColumnVisibilityChange],
    );

    const onRowDoubleClick = useCallback((torrent: Torrent, reveal: boolean = false) => {
        if (TAURI) {
            if (torrent.downloadDir === undefined || torrent.downloadDir === "") return;
            let path = torrent.downloadDir as string;
            if (!path.endsWith("/") && !path.endsWith("\\")) {
                path = path + "/";
            }
            path = path + fileSystemSafeName(torrent.name);
            path = pathMapFromServer(path, serverConfig);
            invoke("shell_open", { path, reveal }).catch(() => {
                notifications.show({
                    title: "Error opening path",
                    message: path,
                    color: "red",
                });
            });
        } else {
            props.modals.current?.editTorrent();
        }
    }, [props.modals, serverConfig]);

    const serverSelected = useServerSelectedTorrents();
    const selected = useMemo(() => Array.from(serverSelected).map(String), [serverSelected]);

    const [info, setInfo, handler] = useContextMenu();

    return (
        <Box w="100%" h="100%" onContextMenu={handler}>
            <MemoizedTorrentContextMenu
                contextMenuInfo={info}
                setContextMenuInfo={setInfo}
                modals={props.modals}
                onRowDoubleClick={onRowDoubleClick} />
            <TrguiTable<Torrent> {...{
                tablename: "torrents",
                columns,
                data: props.torrents,
                getRowId,
                selected,
                selectedReducer: props.selectedReducer,
                setCurrent: props.setCurrentTorrent,
                onVisibilityChange,
                onRowDoubleClick,
                scrollToRow: props.scrollToRow,
            }} />
        </Box>
    );
}

function TorrentContextMenu(props: {
    contextMenuInfo: ContextMenuInfo,
    setContextMenuInfo: (i: ContextMenuInfo) => void,
    modals: React.RefObject<ModalCallbacks>,
    onRowDoubleClick: (t: Torrent, reveal: boolean) => void,
}) {
    const { t } = useTranslation();
    const serverData = useServerTorrentData();
    const serverSelected = useServerSelectedTorrents();
    const rpcVersion = useServerRpcVersion();

    const { onRowDoubleClick } = props;
    const onOpen = useCallback((reveal: boolean) => {
        const torrent = serverData.torrents.find((t) => t.id === serverData.current);
        if (torrent === undefined) return;
        onRowDoubleClick(torrent, reveal);
    }, [onRowDoubleClick, serverData]);

    const mutate = useTorrentAction();

    const torrentAction = useCallback((method: TorrentActionMethodsType, successMessage: string) => {
        mutate(
            {
                method,
                torrentIds: Array.from(serverSelected),
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
    }, [mutate, serverSelected]);

    const [queueSubmenuOpened, setQueueSubmenuOpened] = useState(false);
    const queueRef = useRef<HTMLButtonElement>(null);
    const [queueItemRect, setQueueItemRect] = useState<DOMRect>(() => new DOMRect(0, -100, 0, 0));

    const openQueueSubmenu = useCallback(() => {
        if (queueRef.current == null || serverSelected.size === 0) return;
        setQueueItemRect(queueRef.current.getBoundingClientRect());
        setQueueSubmenuOpened(true);
    }, [serverSelected]);

    const closeQueueSubmenu = useCallback(() => {
        setQueueSubmenuOpened(false);
        setQueueItemRect(new DOMRect(0, -100, 0, 0));
    }, []);

    const copyMagnetLinks = useCallback(() => {
        if (serverSelected.size === 0) return;

        const links = serverData.torrents
            .filter((t) => serverSelected.has(t.id))
            .map((t) => t.magnetLink);

        copyToClipboard(links.join("\n"));

        notifications.show({
            message: serverSelected.size > 1 ? t("contextmenu.magnetsCopied") : t("contextmenu.magnetCopied"),
            color: "green",
        });
    }, [serverData.torrents, serverSelected, t]);

    const hk = useHotkeysContext();

    useEffect(() => {
        hk.handlers.copyToClipboard = copyMagnetLinks;
        return () => { hk.handlers.copyToClipboard = () => { }; };
    }, [copyMagnetLinks, hk]);

    const theme = useMantineTheme();

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
                    onMouseDown={closeQueueSubmenu}
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
                        onClick={() => { torrentAction("queue-move-top", t("contextmenu.queueUpdated")); }}
                        icon={<Icon.ChevronDoubleUp size="1.1rem" />}>
                        {t("contextmenu.queueMoveTop")}
                    </Menu.Item>
                    <Menu.Item
                        onClick={() => { torrentAction("queue-move-up", t("contextmenu.queueUpdated")); }}
                        icon={<Icon.ChevronUp size="1.1rem" />}>
                        {t("contextmenu.queueMoveUp")}
                    </Menu.Item>
                    <Menu.Item
                        onClick={() => { torrentAction("queue-move-down", t("contextmenu.queueUpdated")); }}
                        icon={<Icon.ChevronDown size="1.1rem" />}>
                        {t("contextmenu.queueMoveDown")}
                    </Menu.Item>
                    <Menu.Item
                        onClick={() => { torrentAction("queue-move-bottom", t("contextmenu.queueUpdated")); }}
                        icon={<Icon.ChevronDoubleDown size="1.1rem" />}>
                        {t("contextmenu.queueMoveBottom")}
                    </Menu.Item>
                </Menu.Dropdown>
            </Portal>
        </Menu>
        <ContextMenu contextMenuInfo={props.contextMenuInfo} setContextMenuInfo={props.setContextMenuInfo}>
            <Box miw="14rem">
                {TAURI && <>
                    <Menu.Item
                        onClick={() => { onOpen(false); }}
                        onMouseEnter={closeQueueSubmenu}
                        icon={<Icon.BoxArrowUpRight size="1.1rem" />}
                        disabled={serverData.current === undefined}>
                        <Text weight="bold">{t("contextmenu.open")}</Text>
                    </Menu.Item>
                    <Menu.Item
                        onClick={() => { onOpen(true); }}
                        onMouseEnter={closeQueueSubmenu}
                        icon={<Icon.Folder2Open size="1.1rem" />}
                        disabled={serverData.current === undefined}>
                        <Text>{t("contextmenu.openFolder")}</Text>
                    </Menu.Item>
                    <Menu.Divider />
                </>}
                <Menu.Item
                    onClick={() => { torrentAction("torrent-start-now", t("contextmenu.torrentsStarted")); }}
                    onMouseEnter={closeQueueSubmenu}
                    icon={<Icon.LightningFill size="1.1rem" />}
                    disabled={serverSelected.size === 0}>
                    {t("contextmenu.forceStart")}
                </Menu.Item>
                <Menu.Item
                    onClick={() => { torrentAction("torrent-start", t("contextmenu.torrentsStarted")); }}
                    onMouseEnter={closeQueueSubmenu}
                    icon={<Icon.PlayCircleFill size="1.1rem" />}
                    rightSection={<Kbd>F3</Kbd>}
                    disabled={serverSelected.size === 0}>
                    {t("contextmenu.start")}
                </Menu.Item>
                <Menu.Item
                    onClick={() => { torrentAction("torrent-stop", t("contextmenu.torrentsStopped")); }}
                    onMouseEnter={closeQueueSubmenu}
                    icon={<Icon.PauseCircleFill size="1.1rem" />}
                    rightSection={<Kbd>F4</Kbd>}
                    disabled={serverSelected.size === 0}>
                    {t("contextmenu.pause")}
                </Menu.Item>
                <Menu.Item
                    onClick={() => { torrentAction("torrent-verify", t("contextmenu.torrentsVerificationStarted")); }}
                    onMouseEnter={closeQueueSubmenu}
                    icon={<Icon.CheckAll size="1.1rem" />}
                    disabled={serverSelected.size === 0}>
                    {t("contextmenu.verify")}
                </Menu.Item>
                <Menu.Item
                    onClick={() => { torrentAction("torrent-reannounce", t("contextmenu.torrentsReannounced")); }}
                    onMouseEnter={closeQueueSubmenu}
                    icon={<Icon.Wifi size="1.1rem" />}
                    disabled={serverSelected.size === 0}>
                    {t("contextmenu.reannounce")}
                </Menu.Item>
                <Menu.Item
                    onClick={copyMagnetLinks}
                    onMouseEnter={closeQueueSubmenu}
                    icon={<Icon.MagnetFill size="1.1rem" />}
                    disabled={serverSelected.size === 0}
                    rightSection={<Kbd>{`${modKeyString()} C`}</Kbd>}>
                    {serverSelected.size > 1 ? t("contextmenu.copyMagnet_other") : t("contextmenu.copyMagnet_one")}
                </Menu.Item>
                <Menu.Item ref={queueRef}
                    icon={<Icon.ThreeDots size="1.1rem" />}
                    rightSection={<Icon.ChevronRight size="0.8rem" />}
                    onMouseEnter={openQueueSubmenu}
                    disabled={serverSelected.size === 0}>
                    {t("contextmenu.queue")}
                </Menu.Item>
                <Menu.Item
                    onClick={() => props.modals.current?.move()}
                    onMouseEnter={closeQueueSubmenu}
                    icon={<Icon.FolderFill size="1.1rem" />}
                    disabled={serverSelected.size === 0}
                    rightSection={<Kbd>F6</Kbd>}>
                    {t("contextmenu.move")}
                </Menu.Item>
                <Menu.Item
                    onClick={() => props.modals.current?.setLabels()}
                    onMouseEnter={closeQueueSubmenu}
                    icon={<Icon.TagsFill size="1.1rem" />}
                    disabled={serverSelected.size === 0}
                    rightSection={<Kbd>F7</Kbd>}>
                    {t("contextmenu.setLabels")}
                </Menu.Item>
                <Menu.Item
                    onClick={() => props.modals.current?.remove()}
                    onMouseEnter={closeQueueSubmenu}
                    icon={<Icon.XCircleFill size="1.1rem" color={theme.colors.red[6]} />}
                    disabled={serverSelected.size === 0}
                    rightSection={<Kbd>del</Kbd>}>
                    {t("contextmenu.remove")}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                    onClick={() => props.modals.current?.editTrackers()}
                    icon={<Icon.Wifi size="1.1rem" />}
                    onMouseEnter={closeQueueSubmenu}
                    disabled={serverSelected.size === 0 || (serverSelected.size > 1 && rpcVersion < 17)}>
                    {t("contextmenu.trackers")}
                </Menu.Item>
                <Menu.Item
                    onClick={() => props.modals.current?.editTorrent()}
                    icon={<Icon.GearFill size="1.1rem" />}
                    onMouseEnter={closeQueueSubmenu}
                    disabled={serverSelected.size === 0}>
                    {t("contextmenu.properties")}
                </Menu.Item>
            </Box>
        </ContextMenu>
    </>);
}

const MemoizedTorrentContextMenu = memo(TorrentContextMenu);
