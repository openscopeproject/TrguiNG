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

import React, { memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Torrent, TrackerStats } from "../rpc/torrent";
import { bytesToHumanReadableStr, ensurePathDelimiter, fileSystemSafeName, secondsToHumanReadableStr, timestampToDateString, torrentProgressbarStyle } from "../trutil";
import { FileTreeTable, useUnwantedFiles } from "./tables/filetreetable";
import { PiecesCanvas } from "./piecescanvas";
import { ProgressBar } from "./progressbar";
import { DateField, LabelsField, StatusField, TrackerField } from "./tables/torrenttable";
import { TrackersTable } from "./tables/trackertable";
import { PeersTable } from "./tables/peerstable";
import { Status, type SessionStatEntry } from "rpc/transmission";
import { Anchor, Box, Flex, Container, Group, Table, Tabs, TextInput, LoadingOverlay, Grid } from "@mantine/core";
import * as Icon from "react-bootstrap-icons";
import classes from "./details.module.css";
import { CachedFileTree } from "cachedfiletree";
import { useFileTree, useMutateTorrent, useSessionStats, useTorrentDetails } from "queries";
import { ConfigContext } from "config";
import { useResizeObserver } from "@mantine/hooks";
import { MemoSectionsContextMenu, getSectionsMap } from "./sectionscontextmenu";
import { useContextMenu } from "./contextmenu";
import { useTranslation } from "react-i18next";

interface DetailsProps {
    torrentId?: number,
    updates: boolean,
}

function DownloadBar(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    let prefix = "";
    let percent = props.torrent.percentDone as number;
    if (props.torrent.status === Status.verifying) {
        prefix = t("details.downloadBar.verified");
        percent = props.torrent.recheckProgress;
    } else if (props.torrent.status === Status.downloading && props.torrent.pieceCount === 0) {
        prefix = t("details.downloadBar.downloadingMetadata");
        percent = props.torrent.metadataPercentComplete;
    } else if (props.torrent.status === Status.stopped) {
        prefix = t("details.downloadBar.stopped");
    } else {
        prefix = t("details.downloadBar.downloaded");
    }

    const config = useContext(ConfigContext);
    const now = Math.floor(percent * 1000);
    const nowStr = t("details.downloadBar.label", { prefix, percent: now / 10 });
    const progressbarStyle = torrentProgressbarStyle(props.torrent, config);

    return (
        <Box w="100%" my="0.5rem">
            <ProgressBar
                key={props.torrent.hashString}
                now={now}
                max={1000}
                label={nowStr}
                {...progressbarStyle}
            />
        </Box>
    );
}

interface DetailItemProps extends React.PropsWithChildren {
    name: string,
}

function DetailItem({ name, children }: DetailItemProps) {
    return (
        <Grid.Col span={1} className={classes.detailItemCol}>
            <Flex>
                <Box className={classes.detailItemLabel}>{name}</Box>
                {children}
            </Flex>
        </Grid.Col>
    );
}

function Wasted(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const hashfails = props.torrent.pieceSize > 0 ? props.torrent.corruptEver / props.torrent.pieceSize : 0;
    return <>{t("details.transfer.wastedValue", { size: bytesToHumanReadableStr(props.torrent.corruptEver), count: hashfails })}</>;
}

function DownloadSpeed(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const secondsDownloading = props.torrent.secondsDownloading;
    const speed = `${bytesToHumanReadableStr(props.torrent.rateDownload)}/s`;
    if (secondsDownloading > 0) {
        return <>{t("details.transfer.downloadSpeedAverage", { speed, average: `${bytesToHumanReadableStr(props.torrent.downloadedEver / secondsDownloading)}/s` })}</>;
    } else {
        return <>{speed}</>;
    }
}

function SpeedLimit(props: { torrent: Torrent, field: "download" | "upload" }) {
    const limited = props.field === "download" ? props.torrent.downloadLimited : props.torrent.uploadLimited;
    if (limited !== true) return <>-</>;
    const limit = props.field === "download" ? props.torrent.downloadLimit : props.torrent.uploadLimit;
    if (limit < 0) return <>∞</>;
    return <>{`${bytesToHumanReadableStr(limit * 1024)}/s`}</>;
}

function Seeds(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const sending = props.torrent.peersSendingToUs as number;
    const totalSeeds = props.torrent.cachedSeedsTotal;
    if (totalSeeds < 0) {
        return <>{sending}</>;
    } else {
        return <>{t("details.transfer.seedsOf", { count: sending, total: totalSeeds })}</>;
    }
}

function Peers(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const getting = props.torrent.peersGettingFromUs as number;
    const totalPeers = props.torrent.cachedPeersTotal;
    if (totalPeers < 0) {
        return <>{getting}</>;
    } else {
        return <>{t("details.transfer.peersOf", { count: getting, total: totalPeers })}</>;
    }
}

function TrackerUpdate(props: { torrent: Torrent }) {
    const config = useContext(ConfigContext);
    if (props.torrent.trackerStats.length === 0) return <></>;
    const tracker = props.torrent.trackerStats[0] as TrackerStats;
    const state = tracker.announceState;
    return <>{(state === 2 || state === 3) ? "-" : timestampToDateString(tracker.nextAnnounceTime, config)}</>;
}

function TransferTable(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const seedingTime = secondsToHumanReadableStr(props.torrent.secondsSeeding);
    const shareRatio = `${(props.torrent.uploadRatio as number).toFixed(5)} ${seedingTime !== "" ? `(${seedingTime})` : ""}`;

    const [ref, rect] = useResizeObserver();

    return (
        <Container fluid>
            <Grid
                ref={ref}
                my="sm"
                className={classes.grid}
                columns={rect.width > 850 ? 3 : 1}
            >
                <DetailItem name={t("details.transfer.status")}><StatusField {...props} fieldName="status" /></DetailItem>
                <DetailItem name={t("details.transfer.error")}>{props.torrent.cachedError}</DetailItem>
                <DetailItem name={t("details.transfer.remaining")}>{`${secondsToHumanReadableStr(props.torrent.eta)} (${bytesToHumanReadableStr(props.torrent.leftUntilDone)})`}</DetailItem>
                <DetailItem name={t("details.transfer.downloaded")}>{bytesToHumanReadableStr(props.torrent.downloadedEver)}</DetailItem>
                <DetailItem name={t("details.transfer.uploaded")}>{bytesToHumanReadableStr(props.torrent.uploadedEver)}</DetailItem>
                <DetailItem name={t("details.transfer.wasted")}><Wasted {...props} /></DetailItem>
                <DetailItem name={t("details.transfer.downloadSpeed")}><DownloadSpeed {...props} /></DetailItem>
                <DetailItem name={t("details.transfer.uploadSpeed")}>{`${bytesToHumanReadableStr(props.torrent.rateUpload)}/s`}</DetailItem>
                <DetailItem name={t("details.transfer.shareRatio")}>{shareRatio}</DetailItem>
                <DetailItem name={t("details.transfer.downloadLimit")}><SpeedLimit {...props} field="download" /></DetailItem>
                <DetailItem name={t("details.transfer.uploadLimit")}><SpeedLimit {...props} field="upload" /></DetailItem>
                <DetailItem name={t("details.transfer.bandwidthGroup")}>{props.torrent.group}</DetailItem>
                <DetailItem name={t("details.transfer.seeds")}><Seeds {...props} /></DetailItem>
                <DetailItem name={t("details.transfer.peers")}><Peers {...props} /></DetailItem>
                <DetailItem name={t("details.transfer.maxPeers")}>{props.torrent.maxConnectedPeers}</DetailItem>
                <DetailItem name={t("details.transfer.tracker")}><TrackerField {...props} fieldName="trackerStats" /></DetailItem>
                <DetailItem name={t("details.transfer.trackerUpdateOn")}><TrackerUpdate {...props} /></DetailItem>
                <DetailItem name={t("details.transfer.lastActive")}><DateField {...props} fieldName="activityDate" /></DetailItem>
            </Grid>
        </Container>
    );
}

function TotalSize(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    if (props.torrent.totalSize <= 0) return <>?</>;
    const size = bytesToHumanReadableStr(props.torrent.totalSize);
    const done = bytesToHumanReadableStr(props.torrent.sizeWhenDone - props.torrent.leftUntilDone);
    return <>{t("details.torrent.totalSizeValue", { size, done })}</>;
}

function Pieces(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    if (props.torrent.totalSize <= 0) return <>?</>;
    const pieceSize = bytesToHumanReadableStr(props.torrent.pieceSize);
    let have = 0;
    if (props.torrent.totalSize === props.torrent.haveValid) {
        have = props.torrent.pieceCount;
    } else {
        have = props.torrent.haveValid / (props.torrent.pieceSize > 0 ? props.torrent.pieceSize : 1);
    }

    return <>{t("details.torrent.piecesValue", { count: props.torrent.pieceCount as number, size: pieceSize, have: Math.round(have) })}</>;
}

const httpRe = /https?:\/\//;
const urlRe = /(https?:\/\/[^\s]+)/;

function Urlize(props: { text: string }) {
    if (!httpRe.test(props.text)) return <>{props.text}</>;
    const matches = props.text.split(urlRe).filter((match) => match.length > 0);
    return <>
        {matches.map((match, index) => {
            if (!httpRe.test(match)) return <span key={index}>{match}</span>;
            return <Anchor
                key={index}
                href={match}
                target="_blank"
                rel="noreferrer"
            >
                {match}
            </Anchor>;
        })}
    </>;
}

const readonlyInputStyles = {
    root: classes.readonlyInputRoot,
    input: classes.readonlyInputInput,
};

function TorrentDetails(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const config = useContext(ConfigContext);

    const fullPath = ensurePathDelimiter(props.torrent.downloadDir) + fileSystemSafeName(props.torrent.name);

    const [ref, rect] = useResizeObserver();

    return (
        <Container fluid>
            <Grid
                ref={ref}
                my="sm"
                className={classes.grid}
                columns={rect.width > 850 ? 2 : 1}
            >
                <DetailItem name={t("details.torrent.fullPath")}>
                    <TextInput
                        classNames={readonlyInputStyles}
                        variant="unstyled"
                        readOnly
                        value={fullPath}
                    />
                </DetailItem>
                <DetailItem name={t("details.torrent.created")}>
                    <div>
                        <span>
                            {props.torrent.dateCreated > 0
                                ? timestampToDateString(props.torrent.dateCreated, config)
                                : ""}
                        </span>
                        <span>
                            {(props.torrent.creator === undefined || props.torrent.creator === "")
                                ? ""
                                : t("details.torrent.createdBy", { creator: props.torrent.creator as string })}
                        </span>
                    </div>
                </DetailItem>
                <DetailItem name={t("details.torrent.totalSize")}><TotalSize {...props} /></DetailItem>
                <DetailItem name={t("details.torrent.pieces")}><Pieces {...props} /></DetailItem>
                <DetailItem name={t("details.torrent.hash")}>
                    <TextInput
                        classNames={readonlyInputStyles}
                        variant="unstyled"
                        readOnly
                        value={props.torrent.hashString}
                    />
                </DetailItem>
                <DetailItem name={t("details.torrent.comment")}><Urlize text={props.torrent.comment} /></DetailItem>
                <DetailItem name={t("details.torrent.addedOn")}><DateField {...props} fieldName="addedDate" /></DetailItem>
                <DetailItem name={t("details.torrent.completedOn")}><DateField {...props} fieldName="doneDate" /></DetailItem>
                <DetailItem name={t("details.torrent.magnetLink")}>
                    <TextInput
                        classNames={readonlyInputStyles}
                        variant="unstyled"
                        readOnly
                        value={props.torrent.magnetLink}
                    />
                </DetailItem>
                <DetailItem name={t("details.torrent.labels")}><LabelsField {...props} fieldName="labels" /></DetailItem>
            </Grid>
        </Container>
    );
}

function TableNameRow(props: { children: React.ReactNode }) {
    return (
        <Group grow>
            <Box px="md" className={classes.tableNameRowBox}>
                {props.children}
            </Box>
        </Group>
    );
}

function GeneralPane(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    return (
        <Flex direction="column" h="100%" w="100%">
            <Container fluid mx={0}>
                <DownloadBar {...props} />
            </Container>
            <div style={{ flexGrow: 1 }}>
                <div className="scrollable">
                    <Container fluid>
                        <TableNameRow>{t("details.sections.transfer")}</TableNameRow>
                        <TransferTable {...props} />
                        <TableNameRow>{t("details.sections.torrent")}</TableNameRow>
                        <TorrentDetails {...props} />
                    </Container>
                </div>
            </div>
        </Flex>
    );
}

function FileTreePane(props: { torrent: Torrent }) {
    const fileTree = useMemo(
        () => new CachedFileTree(props.torrent.hashString, props.torrent.id),
        [props.torrent.hashString, props.torrent.id]);

    const { data, refetch } = useFileTree("filetree", fileTree);

    useEffect(() => {
        if (fileTree.initialized) {
            fileTree.update(props.torrent);
        } else {
            fileTree.parse(props.torrent, false);
        }
        void refetch();
    }, [props.torrent, fileTree, refetch]);

    const { mutate } = useMutateTorrent();

    const onCheckboxChange = useUnwantedFiles(fileTree, true);
    const updateUnwanted = useCallback((entryPath: string, state: boolean) => {
        onCheckboxChange(entryPath, state);
        mutate({
            torrentIds: [props.torrent.id],
            fields: { [state ? "files-wanted" : "files-unwanted"]: fileTree.getChildFilesIndexes(entryPath) },
        });
    }, [fileTree, mutate, onCheckboxChange, props.torrent.id]);

    return <FileTreeTable
        fileTree={fileTree}
        data={data}
        downloadDir={props.torrent.downloadDir}
        onCheckboxChange={updateUnwanted}
    />;
}

function Stats(props: { stats: SessionStatEntry }) {
    const { t } = useTranslation();
    return <Table mb="sm" className={classes.statsTable}>
        <tbody>
            <tr>
                <td style={{ width: "10em" }}>{t("details.stats.downloaded")}</td>
                <td>{bytesToHumanReadableStr(props.stats.downloadedBytes)}</td>
            </tr>
            <tr>
                <td>{t("details.stats.uploaded")}</td>
                <td>{bytesToHumanReadableStr(props.stats.uploadedBytes)}</td>
            </tr>
            <tr>
                <td>{t("details.stats.ratio")}</td>
                <td>
                    {props.stats.downloadedBytes === 0
                        ? "∞"
                        : (props.stats.uploadedBytes / props.stats.downloadedBytes).toFixed(2)}
                </td>
            </tr>
            <tr>
                <td>{t("details.stats.filesAdded")}</td>
                <td>{props.stats.filesAdded}</td>
            </tr>
            <tr>
                <td>{t("details.stats.active")}</td>
                <td>{secondsToHumanReadableStr(props.stats.secondsActive)}</td>
            </tr>
            {props.stats.sessionCount > 1
                && <tr>
                    <td>{t("details.stats.sessionCount")}</td>
                    <td>{props.stats.sessionCount}</td>
                </tr>}
        </tbody>
    </Table>;
}

function ServerStats() {
    const { t } = useTranslation();
    const { data: sessionStats } = useSessionStats(true);

    return (
        <Flex direction="column" h="100%" w="100%">
            <div style={{ flexGrow: 1 }}>
                <div className="scrollable">
                    {sessionStats !== undefined
                        ? <Container fluid>
                            <TableNameRow>{t("details.sections.session")}</TableNameRow>
                            <Stats stats={sessionStats["current-stats"]} />
                            <TableNameRow>{t("details.sections.cumulative")}</TableNameRow>
                            <Stats stats={sessionStats["cumulative-stats"]} />
                        </Container>
                        : <></>}
                </div>
            </div>
        </Flex>
    );
}

const DetailsPanels = React.memo(function DetailsPanels({ torrent }: { torrent: Torrent | undefined }) {
    return (<>
        <Tabs.Panel value="General" h="100%">
            {torrent !== undefined
                ? <GeneralPane torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="Files" h="100%">
            {torrent !== undefined
                ? <FileTreePane torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="Pieces" h="100%">
            {torrent !== undefined
                ? <PiecesCanvas torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="Peers" h="100%">
            {torrent !== undefined
                ? <PeersTable torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="Trackers" h="100%">
            {torrent !== undefined
                ? <TrackersTable torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="Server statistics" h="100%">
            <ServerStats />
        </Tabs.Panel>
    </>);
});

function Details(props: DetailsProps) {
    const { t } = useTranslation();
    const config = useContext(ConfigContext);
    const peersTableVisibility = config.getTableColumnVisibility("peers");
    const countryVisible = peersTableVisibility.country ?? true;

    const { data: fetchedTorrent, isLoading } = useTorrentDetails(
        props.torrentId ?? -1, props.torrentId !== undefined && props.updates, countryVisible);

    const [torrent, setTorrent] = useState<Torrent>();

    useEffect(() => {
        if (props.torrentId === undefined) setTorrent(undefined);
        else if (fetchedTorrent !== undefined) setTorrent(fetchedTorrent);
    }, [fetchedTorrent, props.torrentId]);

    const [tabs, setTabs] = useState(config.values.interface.detailsTabs);
    const [tabsMap, setTabsMap] = useState(getSectionsMap(tabs));

    useEffect(() => {
        config.values.interface.detailsTabs = tabs;
        setTabsMap(getSectionsMap(tabs));
    }, [config, tabs]);

    const defaultTab = useMemo(() => {
        return tabs.find((tab) => tab.visible)?.section ?? "";
    }, [tabs]);

    const [info, setInfo, handler] = useContextMenu();

    return (
        <Tabs
            variant="outline"
            defaultValue={defaultTab}
            keepMounted={false}
            h="100%"
            w="100%"
            classNames={{
                root: classes.tabsRoot,
                tab: classes.tabsTab,
                list: classes.tabsList,
            }}
        >
            <Tabs.List px="sm" pt="xs" onContextMenu={handler}>
                <MemoSectionsContextMenu
                    sections={tabs}
                    setSections={setTabs}
                    contextMenuInfo={info}
                    setContextMenuInfo={setInfo}
                    getLabel={(section) => t({
                        General: "details.tabs.general",
                        Files: "details.tabs.files",
                        Pieces: "details.tabs.pieces",
                        Peers: "details.tabs.peers",
                        Trackers: "details.tabs.trackers",
                        "<spacer>": "details.tabs.spacer",
                        "Server statistics": "details.tabs.serverStatistics",
                    }[section])}
                />
                {tabs[tabsMap.General].visible
                    && <Tabs.Tab value="General" disabled={torrent === undefined} style={{ order: tabsMap.General }}>
                        <Group>
                            <Icon.InfoCircle size="1.1rem" />
                            {t("details.tabs.general")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap.Files].visible
                    && <Tabs.Tab value="Files" disabled={torrent === undefined} style={{ order: tabsMap.Files }}>
                        <Group>
                            <Icon.Files size="1.1rem" />
                            {torrent !== undefined
                                ? t("details.tabs.filesCount", { count: torrent.files.length as number })
                                : t("details.tabs.files")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap.Pieces].visible
                    && <Tabs.Tab value="Pieces" disabled={torrent === undefined} style={{ order: tabsMap.Pieces }}>
                        <Group>
                            <Icon.Grid3x2 size="1.1rem" />
                            {torrent !== undefined
                                ? t("details.tabs.piecesCount", { count: torrent.pieceCount as number })
                                : t("details.tabs.pieces")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap.Peers].visible
                    && <Tabs.Tab value="Peers" disabled={torrent === undefined} style={{ order: tabsMap.Peers }}>
                        <Group>
                            <Icon.People size="1.1rem" />
                            {t("details.tabs.peers")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap.Trackers].visible
                    && <Tabs.Tab value="Trackers" disabled={torrent === undefined} style={{ order: tabsMap.Trackers }}>
                        <Group>
                            <Icon.Wifi size="1.1rem" />
                            {t("details.tabs.trackers")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap["<spacer>"]].visible
                    && <Box style={{ flexGrow: 1, order: tabsMap["<spacer>"] }} />}
                {tabs[tabsMap["Server statistics"]].visible
                    && <Tabs.Tab value="Server statistics" style={{ order: tabsMap["Server statistics"] }}>
                        <Group>
                            <Icon.ArrowDownUp size="1.1rem" />
                            {t("details.tabs.serverStatistics")}
                        </Group>
                    </Tabs.Tab>}
            </Tabs.List>
            <div style={{ flexGrow: 1, position: "relative" }}>
                <LoadingOverlay
                    visible={props.torrentId !== undefined && isLoading}
                    zIndex={400}
                    transitionProps={{ duration: 500 }}
                    loaderProps={{ size: "xl" }}
                    overlayProps={{ opacity: 0.35 }}
                />
                <DetailsPanels torrent={torrent} />
            </div>
        </Tabs>
    );
}

export const MemoizedDetails = memo(Details) as typeof Details;
