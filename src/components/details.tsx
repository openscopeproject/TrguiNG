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
import type { MantineTheme } from "@mantine/core";
import { Anchor, Box, Flex, Container, Group, Table, Tabs, TextInput, LoadingOverlay, Grid, useMantineTheme } from "@mantine/core";
import * as Icon from "react-bootstrap-icons";
import { CachedFileTree } from "cachedfiletree";
import { useFileTree, useMutateTorrent, useSessionStats, useTorrentDetails } from "queries";
import { ConfigContext } from "config";
import { useResizeObserver } from "@mantine/hooks";
import { MemoSectionsContextMenu, getSectionsMap } from "./sectionscontextmenu";
import { useContextMenu } from "./contextmenu";
import { useTranslation } from "i18n";

interface DetailsProps {
    torrentId?: number,
    updates: boolean,
}

function DownloadBar(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    let prefix = "";
    let percent = props.torrent.percentDone as number;
    if (props.torrent.status === Status.verifying) {
        prefix = t("torrent.details.verified");
        percent = props.torrent.recheckProgress;
    } else if (props.torrent.status === Status.downloading && props.torrent.pieceCount === 0) {
        prefix = t("torrent.details.downloadingMetadata");
        percent = props.torrent.metadataPercentComplete;
    } else if (props.torrent.status === Status.stopped) {
        prefix = t("torrent.details.stopped");
    } else {
        prefix = t("torrent.details.downloadedPrefix");
    }

    const config = useContext(ConfigContext);
    const now = Math.floor(percent * 1000);
    const nowStr = `${prefix}: ${now / 10}%`;
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
    const theme = useMantineTheme();

    return (
        <Grid.Col span={1} sx={{
            borderBottom: "1px solid",
            borderColor: theme.colorScheme === "dark" ? theme.colors.dark[5] : theme.colors.gray[3],
            padding: "1px 0.4em 0 0.4em",
            lineHeight: 1.4,
        }}>
            <Flex>
                <Box sx={{ flex: "0 0 10em" }}>{name}</Box>
                {children}
            </Flex>
        </Grid.Col>
    );
}

function Wasted(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const hashfails = props.torrent.pieceSize > 0 ? props.torrent.corruptEver / props.torrent.pieceSize : 0;
    return <>{`${bytesToHumanReadableStr(props.torrent.corruptEver)} (${hashfails} ${t("torrent.details.hashfails")})`}</>;
}

function DownloadSpeed(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const secondsDownloading = props.torrent.secondsDownloading;
    const speed = `${bytesToHumanReadableStr(props.torrent.rateDownload)}/s`;
    if (secondsDownloading > 0) {
        return <>{`${speed} (${t("torrent.details.average")}: ${bytesToHumanReadableStr(props.torrent.downloadedEver / secondsDownloading)}/s)`}</>;
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
        return <>{`${sending} ${t("torrent.details.ofConnected", { total: totalSeeds })}`}</>;
    }
}

function Peers(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const getting = props.torrent.peersGettingFromUs as number;
    const totalPeers = props.torrent.cachedPeersTotal;
    if (totalPeers < 0) {
        return <>{getting}</>;
    } else {
        return <>{`${getting} ${t("torrent.details.ofConnected", { total: totalPeers })}`}</>;
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
            <Grid ref={ref} my="sm" sx={{ maxWidth: "100em" }} columns={rect.width > 850 ? 3 : 1}>
                <DetailItem name={t("torrent.details.status")}><StatusField {...props} fieldName="status" /></DetailItem>
                <DetailItem name={t("torrent.details.error")}>{props.torrent.cachedError}</DetailItem>
                <DetailItem name={t("torrent.details.remaining")}>{`${secondsToHumanReadableStr(props.torrent.eta)} (${bytesToHumanReadableStr(props.torrent.leftUntilDone)})`}</DetailItem>
                <DetailItem name={t("torrent.details.downloaded")}>{bytesToHumanReadableStr(props.torrent.downloadedEver)}</DetailItem>
                <DetailItem name={t("torrent.details.uploaded")}>{bytesToHumanReadableStr(props.torrent.uploadedEver)}</DetailItem>
                <DetailItem name={t("torrent.details.wasted")}><Wasted {...props} /></DetailItem>
                <DetailItem name={t("torrent.details.downloadSpeed")}><DownloadSpeed {...props} /></DetailItem>
                <DetailItem name={t("torrent.details.uploadSpeed")}>{`${bytesToHumanReadableStr(props.torrent.rateUpload)}/s`}</DetailItem>
                <DetailItem name={t("torrent.details.shareRatio")}>{shareRatio}</DetailItem>
                <DetailItem name={t("torrent.details.downloadLimit")}><SpeedLimit {...props} field="download" /></DetailItem>
                <DetailItem name={t("torrent.details.uploadLimit")}><SpeedLimit {...props} field="upload" /></DetailItem>
                <DetailItem name={t("torrent.details.bandwidthGroup")}>{props.torrent.group}</DetailItem>
                <DetailItem name={t("torrent.details.seeds")}><Seeds {...props} /></DetailItem>
                <DetailItem name={t("torrent.details.peersLabel")}><Peers {...props} /></DetailItem>
                <DetailItem name={t("torrent.details.maxPeers")}>{props.torrent.maxConnectedPeers}</DetailItem>
                <DetailItem name={t("torrent.details.tracker")}><TrackerField {...props} fieldName="trackerStats" /></DetailItem>
                <DetailItem name={t("torrent.details.trackerUpdateOn")}><TrackerUpdate {...props} /></DetailItem>
                <DetailItem name={t("torrent.details.lastActive")}><DateField {...props} fieldName="activityDate" /></DetailItem>
            </Grid>
        </Container>
    );
}

function TotalSize(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    if (props.torrent.totalSize <= 0) return <>?</>;
    const size = bytesToHumanReadableStr(props.torrent.totalSize);
    const done = bytesToHumanReadableStr(props.torrent.sizeWhenDone - props.torrent.leftUntilDone);
    return <>{`${size} (${done} ${t("torrent.details.done")})`}</>;
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

    return <>{`${props.torrent.pieceCount as number} x ${pieceSize} (${t("torrent.details.have")} ${Math.round(have)})`}</>;
}

const httpRe = /https?:\/\//;
const urlRe = /(https?:\/\/[^\s]+)/;

function Urlize(props: { text: string }) {
    if (!httpRe.test(props.text)) return <>{props.text}</>;
    const matches = props.text.split(urlRe).filter((match) => match.length > 0);
    return <>{matches.map((match, index) => {
        if (!httpRe.test(match)) return <span key={index}>{match}</span>;
        return <Anchor key={index} href={match} target="_blank" rel="noreferrer">{match}</Anchor>;
    })}</>;
}

const readonlyInputStyles = (theme: MantineTheme) => ({
    root: {
        backgroundColor: (theme.colorScheme === "dark" ? theme.colors.dark[4] : theme.colors.gray[2]),
        height: "1.25rem",
        flexGrow: 1,
    },
    input: {
        minHeight: "1.25rem",
        height: "1.25rem",
        lineHeight: "1rem",
        cursor: "text",
    },
});

function TorrentDetails(props: { torrent: Torrent }) {
    const { t } = useTranslation();
    const config = useContext(ConfigContext);

    const fullPath = ensurePathDelimiter(props.torrent.downloadDir) + fileSystemSafeName(props.torrent.name);

    const [ref, rect] = useResizeObserver();

    return (
        <Container fluid>
            <Grid ref={ref} my="sm" sx={{ maxWidth: "100em" }} columns={rect.width > 850 ? 2 : 1}>
                <DetailItem name={t("torrent.details.fullPath")}>
                    <TextInput styles={readonlyInputStyles} variant="unstyled" readOnly value={fullPath} />
                </DetailItem>
                <DetailItem name={t("torrent.details.createdDate")}>
                    <div>
                        <span>
                            {props.torrent.dateCreated > 0
                                ? timestampToDateString(props.torrent.dateCreated, config)
                                : ""}
                        </span>
                        <span>
                            {(props.torrent.creator === undefined || props.torrent.creator === "")
                                ? ""
                                : ` ${t("torrent.details.by")} ${props.torrent.creator as string}`}
                        </span>
                    </div>
                </DetailItem>
                <DetailItem name={t("torrent.details.totalSize")}><TotalSize {...props} /></DetailItem>
                <DetailItem name={t("torrent.details.pieces")}><Pieces {...props} /></DetailItem>
                <DetailItem name={t("torrent.details.hash")}>
                    <TextInput styles={readonlyInputStyles} variant="unstyled" readOnly value={props.torrent.hashString} />
                </DetailItem>
                <DetailItem name={t("torrent.details.comment")}><Urlize text={props.torrent.comment} /></DetailItem>
                <DetailItem name={t("torrent.details.addedOn")}><DateField {...props} fieldName="addedDate" /></DetailItem>
                <DetailItem name={t("torrent.details.completedOn")}><DateField {...props} fieldName="doneDate" /></DetailItem>
                <DetailItem name={t("torrent.details.magnetLink")}>
                    <TextInput styles={readonlyInputStyles} variant="unstyled" readOnly value={props.torrent.magnetLink} />
                </DetailItem>
                <DetailItem name={t("torrent.details.labels")}><LabelsField {...props} fieldName="labels" /></DetailItem>
            </Grid>
        </Container>
    );
}

function TableNameRow(props: { children: React.ReactNode }) {
    return (
        <Group grow>
            <Box px="md" sx={(theme) => ({
                backgroundColor: theme.colorScheme === "dark" ? theme.colors.dark[4] : theme.colors.gray[3],
                fontSize: "1.25rem",
                fontWeight: "bolder",
            })}>
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
                        <TableNameRow>{t("torrent.details.transfer")}</TableNameRow>
                        <TransferTable {...props} />
                        <TableNameRow>{t("torrent.details.torrent")}</TableNameRow>
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

    return (
        <FileTreeTable
            fileTree={fileTree}
            data={data}
            downloadDir={props.torrent.downloadDir}
            onCheckboxChange={updateUnwanted} />
    );
}

function Stats(props: { stats: SessionStatEntry }) {
    const { t } = useTranslation();
    return <Table mb="sm" sx={{ maxWidth: "25em" }}>
        <tbody>
            <tr>
                <td style={{ width: "10em" }}>{t("torrent.details.downloaded")}</td>
                <td>{bytesToHumanReadableStr(props.stats.downloadedBytes)}</td>
            </tr>
            <tr>
                <td>{t("torrent.details.uploaded")}</td>
                <td>{bytesToHumanReadableStr(props.stats.uploadedBytes)}</td>
            </tr>
            <tr>
                <td>{t("torrent.details.ratio")}</td>
                <td>
                    {props.stats.downloadedBytes === 0
                        ? "∞"
                        : (props.stats.uploadedBytes / props.stats.downloadedBytes).toFixed(2)}
                </td>
            </tr>
            <tr>
                <td>{t("torrent.details.filesAdded")}</td>
                <td>{props.stats.filesAdded}</td>
            </tr>
            <tr>
                <td>{t("torrent.details.active")}</td>
                <td>{secondsToHumanReadableStr(props.stats.secondsActive)}</td>
            </tr>
            {props.stats.sessionCount > 1 &&
                <tr><td>{t("torrent.details.sessionCount")}</td><td>{props.stats.sessionCount}</td></tr>}
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
                            <TableNameRow>{t("torrent.details.session")}</TableNameRow>
                            <Stats stats={sessionStats["current-stats"]} />
                            <TableNameRow>{t("torrent.details.cumulative")}</TableNameRow>
                            <Stats stats={sessionStats["cumulative-stats"]} />
                        </Container>
                        : <></>
                    }
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

    const detailsTabLabels = useCallback((section: string): string => {
        const labelMap: Record<string, string> = {
            "General": t("torrent.details.tabs.general"),
            "Files": t("torrent.details.tabs.files"),
            "Pieces": t("torrent.details.tabs.pieces"),
            "Peers": t("torrent.details.tabs.peers"),
            "Trackers": t("torrent.details.tabs.trackers"),
            "Server statistics": t("torrent.details.tabs.serverStats"),
            "<spacer>": t("torrent.details.tabs.spacer"),
        };
        return labelMap[section] ?? section;
    }, [t]);

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
        <Tabs variant="outline" defaultValue={defaultTab} keepMounted={false}
            h="100%" w="100%"
            styles={((theme) => ({
                root: {
                    display: "flex",
                    flexDirection: "column",
                },
                tab: {
                    borderColor: theme.colorScheme === "dark" ? theme.colors.dark[5] : theme.colors.gray[2],
                    "&[data-active]": {
                        borderColor: theme.colorScheme === "dark" ? theme.colors.dark[3] : theme.colors.gray[5],
                    },
                },
            }))}>
            <Tabs.List px="sm" pt="xs" onContextMenu={handler}>
                <MemoSectionsContextMenu
                    sections={tabs} setSections={setTabs}
                    contextMenuInfo={info} setContextMenuInfo={setInfo}
                    labelRenderer={detailsTabLabels} />
                {tabs[tabsMap.General].visible &&
                    <Tabs.Tab value="General" disabled={torrent === undefined} style={{ order: tabsMap.General }}>
                        <Group>
                            <Icon.InfoCircle size="1.1rem" />
                            {t("torrent.details.tabs.general")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap.Files].visible &&
                    <Tabs.Tab value="Files" disabled={torrent === undefined} style={{ order: tabsMap.Files }}>
                        <Group>
                            <Icon.Files size="1.1rem" />
                            {torrent !== undefined
                                ? t("torrent.details.tabs.filesWithCount", { count: torrent.files.length as number })
                                : t("torrent.details.tabs.files")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap.Pieces].visible &&
                    <Tabs.Tab value="Pieces" disabled={torrent === undefined} style={{ order: tabsMap.Pieces }}>
                        <Group>
                            <Icon.Grid3x2 size="1.1rem" />
                            {torrent !== undefined
                                ? t("torrent.details.tabs.piecesWithCount", { count: torrent.pieceCount as number })
                                : t("torrent.details.tabs.pieces")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap.Peers].visible &&
                    <Tabs.Tab value="Peers" disabled={torrent === undefined} style={{ order: tabsMap.Peers }}>
                        <Group>
                            <Icon.People size="1.1rem" />
                            {t("torrent.details.tabs.peers")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap.Trackers].visible &&
                    <Tabs.Tab value="Trackers" disabled={torrent === undefined} style={{ order: tabsMap.Trackers }}>
                        <Group>
                            <Icon.Wifi size="1.1rem" />
                            {t("torrent.details.tabs.trackers")}
                        </Group>
                    </Tabs.Tab>}
                {tabs[tabsMap["<spacer>"]].visible &&
                    <Box style={{ flexGrow: 1, order: tabsMap["<spacer>"] }} />}
                {tabs[tabsMap["Server statistics"]].visible &&
                    <Tabs.Tab value="Server statistics" style={{ order: tabsMap["Server statistics"] }}>
                        <Group>
                            <Icon.ArrowDownUp size="1.1rem" />
                            {t("torrent.details.tabs.serverStats")}
                        </Group>
                    </Tabs.Tab>}
            </Tabs.List>
            <div style={{ flexGrow: 1, position: "relative" }}>
                <LoadingOverlay
                    visible={props.torrentId !== undefined && isLoading}
                    zIndex={400}
                    transitionDuration={500}
                    loaderProps={{ size: "xl" }}
                    overlayOpacity={0.35} />
                <DetailsPanels torrent={torrent} />
            </div>
        </Tabs>
    );
}

export const MemoizedDetails = memo(Details) as typeof Details;
