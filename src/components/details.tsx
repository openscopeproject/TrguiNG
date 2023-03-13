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

import React, { useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { Container, Form, Nav, Row, Tab, Table } from "react-bootstrap";
import { CachedFileTree } from "../cachedfiletree";
import { ClientManager } from "../clientmanager";
import { ServerConfigContext } from "../config";
import { getTorrentError, Torrent } from "../rpc/torrent";
import { bytesToHumanReadableStr, ensurePathDelimiter, secondsToHumanReadableStr, timestampToDateString } from "../util";
import { FileTreeTable } from "./filetreetable";
import { PiecesCanvas } from "./piecescanvas";
import { ProgressBar } from "./progressbar";
import { DateField, EtaField, LabelsField, StatusField, TrackerField } from "./torrenttable";

interface DetailsProps {
    torrentId?: number;
    clientManager: ClientManager;
}

function DownloadBar(props: { torrent: Torrent }) {
    // temporarily just a progress bar
    const percent = props.torrent.status == 2 ? props.torrent.recheckProgress : props.torrent.percentDone;
    const now = Math.round(percent * 1000);
    const nowStr = `${Math.floor(now / 10.0)}.${now % 10}%`;
    return (
        <div className="d-flex py-1 align-items-center">
            <div className="me-2">{props.torrent.status == 2 ? "Verified:" : "Downloaded:"}</div>
            <ProgressBar now={now} max={1000} label={nowStr} className="flex-grow-1" />
        </div>
    );
}

function Wasted(props: { torrent: Torrent }) {
    const hashfails = props.torrent.pieceSize > 0 ? props.torrent.corruptEver / props.torrent.pieceSize : 0;
    return <>{`${bytesToHumanReadableStr(props.torrent.corruptEver)} (${hashfails} hashfails)`}</>;
}

function DownloadSpeed(props: { torrent: Torrent }) {
    const secondsDownloading = props.torrent.secondsDownloading;
    const speed = `${bytesToHumanReadableStr(props.torrent.rateDownload)}/s`;
    if (secondsDownloading > 0)
        return <>{`${speed} (average: ${bytesToHumanReadableStr(props.torrent.downloadedEver / secondsDownloading)}/s)`}</>;
    else
        return <>{speed}</>;
}

function SpeedLimit(props: { torrent: Torrent, field: "download" | "upload" }) {
    const limited = props.field === "download" ? props.torrent.downloadLimited : props.torrent.uploadLimited;
    if (!limited) return <>-</>;
    const limit = props.field === "download" ? props.torrent.downloadLimit : props.torrent.uploadLimit;
    if (limit < 0) return <>∞</>;
    return <>{`${bytesToHumanReadableStr(limit * 1024)}/s`}</>;
}

function Seeds(props: { torrent: Torrent }) {
    const sending = props.torrent.peersSendingToUs;
    var totalSeeds = props.torrent.trackerStats.length > 0 ? 0 : -1;
    props.torrent.trackerStats.forEach((tracker: any) => { totalSeeds += tracker.seederCount });
    if (totalSeeds < 0)
        return <>{sending}</>;
    else
        return <>{`${sending} of ${totalSeeds} connected`}</>;
}

function Peers(props: { torrent: Torrent }) {
    const getting = props.torrent.peersGettingFromUs;
    var totalLeechers = props.torrent.trackerStats.length > 0 ? 0 : -1;
    props.torrent.trackerStats.forEach((tracker: any) => { totalLeechers += tracker.leecherCount });
    if (totalLeechers < 0)
        return <>{getting}</>;
    else
        return <>{`${getting} of ${totalLeechers} connected`}</>;
}

function TrackerUpdate(props: { torrent: Torrent }) {
    const tracker = props.torrent.trackerStats.length > 0 ? props.torrent.trackerStats[0] : null;
    if (!tracker) return <></>;
    const state = tracker.announceState;
    return <>{timestampToDateString((state == 2 || state == 3) ? 1 : tracker.nextAnnounceTime)}</>;
}

function TransferTable(props: { torrent: Torrent }) {
    return (
        <Table size="sm">
            <tbody>
                <tr>
                    <td>Status:</td><td><StatusField {...props} fieldName="status" /></td>
                    <td>Error:</td><td>{getTorrentError(props.torrent)}</td>
                    <td>Remaining:</td><td><EtaField {...props} fieldName="eta" />{` (${bytesToHumanReadableStr(props.torrent.leftUntilDone)})`}</td>
                </tr>
                <tr>
                    <td>Downloaded:</td><td>{bytesToHumanReadableStr(props.torrent.downloadedEver)}</td>
                    <td>Uploaded:</td><td>{bytesToHumanReadableStr(props.torrent.uploadedEver)}</td>
                    <td>Wasted:</td><td><Wasted {...props} /></td>
                </tr>
                <tr>
                    <td>Download speed:</td><td><DownloadSpeed {...props} /></td>
                    <td>Upload speed:</td><td>{`${bytesToHumanReadableStr(props.torrent.rateUpload)}/s`}</td>
                    <td>Share ratio:</td><td>{`${props.torrent.uploadRatio} (${secondsToHumanReadableStr(props.torrent.secondsSeeding)})`}</td>
                </tr>
                <tr>
                    <td>Download limit:</td><td><SpeedLimit {...props} field="download" /></td>
                    <td>Upload limit:</td><td><SpeedLimit {...props} field="upload" /></td>
                    <td>Bandwidth group:</td><td>{props.torrent.group}</td>
                </tr>
                <tr>
                    <td>Seeds:</td><td><Seeds {...props} /></td>
                    <td>Peers:</td><td><Peers {...props} /></td>
                    <td>Max peers:</td><td>{props.torrent.maxConnectedPeers}</td>
                </tr>
                <tr>
                    <td>Tracker:</td><td><TrackerField {...props} fieldName="trackerStats" /></td>
                    <td>Tracker update on:</td><td><TrackerUpdate {...props} /></td>
                    <td>Last active:</td><td><DateField {...props} fieldName="activityDate" /></td>
                </tr>
            </tbody>
        </Table>
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
    var have = 0;
    if (props.torrent.totalSize == props.torrent.haveValid)
        have = props.torrent.pieceCount;
    else
        have = props.torrent.haveValid / (props.torrent.pieceSize ? props.torrent.pieceSize : 1);

    return <>{`${props.torrent.pieceCount} x ${pieceSize} (have ${Math.round(have)})`}</>;
}

const httpRe = /https?:\/\//;
const urlRe = /(https?:\/\/[^\s]+)/;

function Urlize(props: { text: string }) {
    if (!httpRe.test(props.text)) return <>text</>;
    const matches = props.text.split(urlRe).filter((match) => match.length > 0);
    return <>{matches.map((match, index) => {
        if (!httpRe.test(match)) return <span key={index}>{match}</span>;
        return <a key={index} href={match} target="_blank">{match}</a>;
    })}</>;
}

function TorrentTable(props: { torrent: Torrent }) {
    return (
        <Table size="sm">
            <tbody>
                <tr>
                    <td>Full path:</td><td>{ensurePathDelimiter(props.torrent.downloadDir) + props.torrent.name}</td>
                    <td>Created on:</td><td><DateField {...props} fieldName="dateCreated" /><span>{` by ${props.torrent.creator}`}</span></td>
                </tr>
                <tr>
                    <td>Total size:</td><td><TotalSize {...props} /></td>
                    <td>Pieces:</td><td><Pieces {...props} /></td>
                </tr>
                <tr>
                    <td>Hash:</td><td><Form.Control size="sm" plaintext readOnly defaultValue={props.torrent.hashString} style={{ "padding": 0 }} /></td>
                    <td>Comment:</td><td><Urlize text={props.torrent.comment} /></td>
                </tr>
                <tr>
                    <td>Added on:</td><td><DateField {...props} fieldName="addedDate" /></td>
                    <td>Completed on:</td><td><DateField {...props} fieldName="doneDate" /></td>
                </tr>
                <tr>
                    <td>Magnet link:</td><td><Form.Control size="sm" plaintext readOnly defaultValue={props.torrent.magnetLink} style={{ "padding": 0 }} /></td>
                    <td>Labels:</td><td><LabelsField {...props} fieldName="labels" /></td>
                </tr>
            </tbody>
        </Table>
    );
}

function GeneralPane(props: { torrent: Torrent }) {
    return (
        <div className="d-flex flex-column h-100 w-100">
            <DownloadBar {...props} />
            <div className="flex-grow-1">
                <div className="scrollable">
                    <Container fluid>
                        <Row><h5 className="bg-light">Transfer</h5></Row>
                        <TransferTable {...props} />
                        <Row><h5 className="bg-light">Torrent</h5></Row>
                        <TorrentTable {...props} />
                    </Container>
                </div>
            </div>
        </div>
    );
}

export function Details(props: DetailsProps) {
    const serverConfig = useContext(ServerConfigContext);

    const [torrent, setTorrent] = useState<Torrent>();

    useEffect(() => {
        setTorrent(props.clientManager.servers[serverConfig.name].torrentDetails);
    }, [serverConfig, props.clientManager]);

    useEffect(() => {
        props.clientManager.setServerDetailsId(serverConfig.name, props.torrentId);

        if (!props.torrentId) return () => { };

        props.clientManager.onTorrentDetailsChange = setTorrent;
        props.clientManager.startDetailsTimer(serverConfig.name);

        return () => {
            props.clientManager.onTorrentDetailsChange = undefined;
        }
    }, [props.torrentId]);

    if (!torrent) return <div className="p-3">Select a torrent to view it's details</div>;

    return (
        <Container fluid className="d-flex flex-column h-100">
            <Tab.Container id="details-tabs" defaultActiveKey="general">
                <Nav variant="tabs">
                    <Nav.Link eventKey="general">General</Nav.Link>
                    <Nav.Link eventKey="files">{`Files (${torrent.files.length})`}</Nav.Link>
                    <Nav.Link eventKey="pieces">{`Pieces (${torrent.pieceCount})`}</Nav.Link>
                    <Nav.Link eventKey="peers">Peers</Nav.Link>
                    <Nav.Link eventKey="trackers">Trackers</Nav.Link>
                    <Nav.Link eventKey="stats">Stats</Nav.Link>
                </Nav>
                <Tab.Content className="flex-grow-1">
                    <Tab.Pane eventKey="general" className="h-100">
                        <GeneralPane torrent={torrent} />
                    </Tab.Pane>
                    <Tab.Pane eventKey="files" className="h-100">
                        <FileTreeTable torrent={torrent}/>
                    </Tab.Pane>
                    <Tab.Pane eventKey="pieces" className="h-100">
                        <PiecesCanvas torrent={torrent} />
                    </Tab.Pane>
                    <Tab.Pane eventKey="peers">
                        todo peers
                    </Tab.Pane>
                    <Tab.Pane eventKey="trackers">
                        todo trackers
                    </Tab.Pane>
                    <Tab.Pane eventKey="stats">
                        todo stats
                    </Tab.Pane>
                </Tab.Content>
            </Tab.Container>
        </Container>
    );
}
