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
import { bytesToHumanReadableStr, ensurePathDelimiter, fileSystemSafeName, secondsToHumanReadableStr, timestampToDateString } from "../trutil";
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

interface DetailsProps {
    torrentId?: number,
    updates: boolean,
}

function DownloadBar(props: { torrent: Torrent }) {
    let prefix = "";
    let percent = props.torrent.percentDone as number;
    if (props.torrent.status === Status.verifying) {
        prefix = "Verified";
        percent = props.torrent.recheckProgress;
    } else if (props.torrent.status === Status.downloading && props.torrent.pieceCount === 0) {
        prefix = "Downloading metadata";
        percent = props.torrent.metadataPercentComplete;
    } else if (props.torrent.status === Status.stopped) {
        prefix = "Stopped";
    } else {
        prefix = "Downloaded";
    }

    const now = Math.floor(percent * 1000);
    const nowStr = `${prefix}: ${now / 10}%`;
    return (
        <Box w="100%" my="0.5rem">
            <ProgressBar now={now} max={1000} label={nowStr} />
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
    const hashfails = props.torrent.pieceSize > 0 ? props.torrent.corruptEver / props.torrent.pieceSize : 0;
    return <>{`${bytesToHumanReadableStr(props.torrent.corruptEver)} (${hashfails} hashfails)`}</>;
}

function DownloadSpeed(props: { torrent: Torrent }) {
    const secondsDownloading = props.torrent.secondsDownloading;
    const speed = `${bytesToHumanReadableStr(props.torrent.rateDownload)}/s`;
    if (secondsDownloading > 0) {
        return <>{`${speed} (average: ${bytesToHumanReadableStr(props.torrent.downloadedEver / secondsDownloading)}/s)`}</>;
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
    const sending = props.torrent.peersSendingToUs as number;
    const totalSeeds = props.torrent.cachedSeedsTotal;
    if (totalSeeds < 0) {
        return <>{sending}</>;
    } else {
        return <>{`${sending} of ${totalSeeds} connected`}</>;
    }
}

function Peers(props: { torrent: Torrent }) {
    const getting = props.torrent.peersGettingFromUs as number;
    const totalPeers = props.torrent.cachedPeersTotal;
    if (totalPeers < 0) {
        return <>{getting}</>;
    } else {
        return <>{`${getting} of ${totalPeers} connected`}</>;
    }
}

function TrackerUpdate(props: { torrent: Torrent }) {
    if (props.torrent.trackerStats.length === 0) return <></>;
    const tracker = props.torrent.trackerStats[0] as TrackerStats;
    const state = tracker.announceState;
    return <>{(state === 2 || state === 3) ? "-" : timestampToDateString(tracker.nextAnnounceTime)}</>;
}

function TransferTable(props: { torrent: Torrent }) {
    const seedingTime = secondsToHumanReadableStr(props.torrent.secondsSeeding);
    const shareRatio = `${props.torrent.uploadRatio as number} ${seedingTime !== "" ? `(${seedingTime})` : ""}`;

    const [ref, rect] = useResizeObserver();

    return (
        <Container fluid>
            <Grid ref={ref} my="sm" sx={{ maxWidth: "100em" }} columns={rect.width > 850 ? 3 : 1}>
                <DetailItem name="Status:"><StatusField {...props} fieldName="status" /></DetailItem>
                <DetailItem name="Error:">{props.torrent.cachedError}</DetailItem>
                <DetailItem name="Remaining:">{`${secondsToHumanReadableStr(props.torrent.eta)} (${bytesToHumanReadableStr(props.torrent.leftUntilDone)})`}</DetailItem>
                <DetailItem name="Downloaded:">{bytesToHumanReadableStr(props.torrent.downloadedEver)}</DetailItem>
                <DetailItem name="Uploaded:">{bytesToHumanReadableStr(props.torrent.uploadedEver)}</DetailItem>
                <DetailItem name="Wasted:"><Wasted {...props} /></DetailItem>
                <DetailItem name="Download speed:"><DownloadSpeed {...props} /></DetailItem>
                <DetailItem name="Upload speed:">{`${bytesToHumanReadableStr(props.torrent.rateUpload)}/s`}</DetailItem>
                <DetailItem name="Share ratio:">{shareRatio}</DetailItem>
                <DetailItem name="Download limit:"><SpeedLimit {...props} field="download" /></DetailItem>
                <DetailItem name="Upload limit:"><SpeedLimit {...props} field="upload" /></DetailItem>
                <DetailItem name="Bandwidth group:">{props.torrent.group}</DetailItem>
                <DetailItem name="Seeds:"><Seeds {...props} /></DetailItem>
                <DetailItem name="Peers:"><Peers {...props} /></DetailItem>
                <DetailItem name="Max peers:">{props.torrent.maxConnectedPeers}</DetailItem>
                <DetailItem name="Tracker:"><TrackerField {...props} fieldName="trackerStats" /></DetailItem>
                <DetailItem name="Tracker update on:"><TrackerUpdate {...props} /></DetailItem>
                <DetailItem name="Last active:"><DateField {...props} fieldName="activityDate" /></DetailItem>
            </Grid>
        </Container>
    );
}

function TotalSize(props: { torrent: Torrent }) {
    if (props.torrent.totalSize <= 0) return <>?</>;
    const size = bytesToHumanReadableStr(props.torrent.totalSize);
    const done = bytesToHumanReadableStr(props.torrent.sizeWhenDone - props.torrent.leftUntilDone);
    return <>{`${size} (${done} done)`}</>;
}

function Pieces(props: { torrent: Torrent }) {
    if (props.torrent.totalSize <= 0) return <>?</>;
    const pieceSize = bytesToHumanReadableStr(props.torrent.pieceSize);
    let have = 0;
    if (props.torrent.totalSize === props.torrent.haveValid) {
        have = props.torrent.pieceCount;
    } else {
        have = props.torrent.haveValid / (props.torrent.pieceSize > 0 ? props.torrent.pieceSize : 1);
    }

    return <>{`${props.torrent.pieceCount as number} x ${pieceSize} (have ${Math.round(have)})`}</>;
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
    const fullPath = ensurePathDelimiter(props.torrent.downloadDir) + fileSystemSafeName(props.torrent.name);

    const [ref, rect] = useResizeObserver();

    return (
        <Container fluid>
            <Grid ref={ref} my="sm" sx={{ maxWidth: "100em" }} columns={rect.width > 850 ? 2 : 1}>
                <DetailItem name="Full path:">
                    <TextInput styles={readonlyInputStyles} variant="unstyled" readOnly value={fullPath} />
                </DetailItem>
                <DetailItem name="Created:">
                    <div>
                        <span>
                            {props.torrent.dateCreated > 0
                                ? timestampToDateString(props.torrent.dateCreated)
                                : ""}
                        </span>
                        <span>
                            {(props.torrent.creator === undefined || props.torrent.creator === "")
                                ? ""
                                : ` by ${props.torrent.creator as string}`}
                        </span>
                    </div>
                </DetailItem>
                <DetailItem name="Total size:"><TotalSize {...props} /></DetailItem>
                <DetailItem name="Pieces:"><Pieces {...props} /></DetailItem>
                <DetailItem name="Hash:">
                    <TextInput styles={readonlyInputStyles} variant="unstyled" readOnly value={props.torrent.hashString} />
                </DetailItem>
                <DetailItem name="Comment:"><Urlize text={props.torrent.comment} /></DetailItem>
                <DetailItem name="Added on:"><DateField {...props} fieldName="addedDate" /></DetailItem>
                <DetailItem name="Completed on:"><DateField {...props} fieldName="doneDate" /></DetailItem>
                <DetailItem name="Magnet link:">
                    <TextInput styles={readonlyInputStyles} variant="unstyled" readOnly value={props.torrent.magnetLink} />
                </DetailItem>
                <DetailItem name="Labels:"><LabelsField {...props} fieldName="labels" /></DetailItem>
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
    return (
        <Flex direction="column" h="100%" w="100%">
            <Container fluid mx={0}>
                <DownloadBar {...props} />
            </Container>
            <div style={{ flexGrow: 1 }}>
                <div className="scrollable">
                    <Container fluid>
                        <TableNameRow>Transfer</TableNameRow>
                        <TransferTable {...props} />
                        <TableNameRow>Torrent</TableNameRow>
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
    return <Table mb="sm" sx={{ maxWidth: "25em" }}>
        <tbody>
            <tr>
                <td style={{ width: "10em" }}>Downloaded</td>
                <td>{bytesToHumanReadableStr(props.stats.downloadedBytes)}</td>
            </tr>
            <tr>
                <td>Uploaded</td>
                <td>{bytesToHumanReadableStr(props.stats.uploadedBytes)}</td>
            </tr>
            <tr>
                <td>Ratio</td>
                <td>
                    {props.stats.downloadedBytes === 0
                        ? "∞"
                        : (props.stats.uploadedBytes / props.stats.downloadedBytes).toFixed(2)}
                </td>
            </tr>
            <tr>
                <td>Files added</td>
                <td>{props.stats.filesAdded}</td>
            </tr>
            <tr>
                <td>Active</td>
                <td>{secondsToHumanReadableStr(props.stats.secondsActive)}</td>
            </tr>
            {props.stats.sessionCount > 1 &&
                <tr><td>Sesssion count</td><td>{props.stats.sessionCount}</td></tr>}
        </tbody>
    </Table>;
}

function ServerStats() {
    const { data: sessionStats } = useSessionStats(true);

    return (
        <Flex direction="column" h="100%" w="100%">
            <div style={{ flexGrow: 1 }}>
                <div className="scrollable">
                    {sessionStats !== undefined
                        ? <Container fluid>
                            <TableNameRow>Session</TableNameRow>
                            <Stats stats={sessionStats["current-stats"]} />
                            <TableNameRow>Cumulative</TableNameRow>
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
        <Tabs.Panel value="general" h="100%">
            {torrent !== undefined
                ? <GeneralPane torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="files" h="100%">
            {torrent !== undefined
                ? <FileTreePane torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="pieces" h="100%">
            {torrent !== undefined
                ? <PiecesCanvas torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="peers" h="100%">
            {torrent !== undefined
                ? <PeersTable torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="trackers" h="100%">
            {torrent !== undefined
                ? <TrackersTable torrent={torrent} />
                : <></>}
        </Tabs.Panel>
        <Tabs.Panel value="serverstats" h="100%">
            <ServerStats />
        </Tabs.Panel>
    </>);
});

function Details(props: DetailsProps) {
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

    return (
        <Tabs variant="outline" defaultValue="general" keepMounted={false}
            h="100%" w="100%" sx={{ display: "flex", flexDirection: "column" }}>
            <Tabs.List px="sm" pt="xs">
                <Tabs.Tab value="general" disabled={torrent === undefined}>
                    <Group>
                        <Icon.InfoCircle size="1.1rem" />
                        General
                    </Group>
                </Tabs.Tab>
                <Tabs.Tab value="files" disabled={torrent === undefined}>
                    <Group>
                        <Icon.Files size="1.1rem" />
                        {`Files${torrent !== undefined ? ` (${torrent.files.length as number})` : ""}`}
                    </Group>
                </Tabs.Tab>
                <Tabs.Tab value="pieces" disabled={torrent === undefined}>
                    <Group>
                        <Icon.Grid3x2 size="1.1rem" />
                        {`Pieces${torrent !== undefined ? ` (${torrent.pieceCount as number})` : ""}`}
                    </Group>
                </Tabs.Tab>
                <Tabs.Tab value="peers" disabled={torrent === undefined}>
                    <Group>
                        <Icon.People size="1.1rem" />
                        Peers
                    </Group>
                </Tabs.Tab>
                <Tabs.Tab value="trackers" disabled={torrent === undefined}>
                    <Group>
                        <Icon.Wifi size="1.1rem" />
                        Trackers
                    </Group>
                </Tabs.Tab>
                <Tabs.Tab value="serverstats" ml="auto">
                    <Group>
                        <Icon.ArrowDownUp size="1.1rem" />
                        Server statistics
                    </Group>
                </Tabs.Tab>
            </Tabs.List>
            <div style={{ flexGrow: 1, position: "relative" }}>
                <LoadingOverlay
                    visible={props.torrentId !== undefined && isLoading} transitionDuration={500}
                    loaderProps={{ size: "xl" }}
                    overlayOpacity={0.35} />
                <DetailsPanels torrent={torrent} />
            </div>
        </Tabs>
    );
}

export const MemoizedDetails = memo(Details) as typeof Details;
