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

import React from "react";
import { Col, Container, Nav, ProgressBar, Row, Tab, Table, Tabs } from "react-bootstrap";
import { getTorrentError, Torrent } from "../rpc/torrent";
import { bytesToHumanReadableStr, secondsToHumanReadableStr, timestampToDateString } from "../util";
import { DateField, EtaField, StatusField, TrackerField } from "./torrenttable";

interface DetailsProps {
    torrent?: Torrent;
}

function DownloadBar(props: { torrent: Torrent }) {
    // temporarily just a progress bar
    const now = Math.round(props.torrent.percentDone * 1000);
    const nowStr = `${Math.floor(now / 10.0)}.${now % 10}%`;
    return (
        <div className="d-flex py-1 align-items-center">
            <div>Downloaded:</div>
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

function SpeedLimit(props: { torrent: Torrent, field: string }) {
    const limited = props.torrent[props.field + "Limited"];
    if (!limited) return <>-</>;
    const limit = props.torrent[props.field + "Limit"];
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

function TorrentTable(props: { torrent: Torrent }) {
    return (
        <Table size="sm">
            <tbody>
                <tr>
                    <td>Name:</td><td></td>
                    <td>Created on:</td><td></td>
                </tr>
                <tr>
                    <td>Total size:</td><td></td>
                    <td>Pieces:</td><td></td>
                </tr>
                <tr>
                    <td>Hash:</td><td></td>
                    <td>Comment:</td><td></td>
                </tr>
                <tr>
                    <td>Added on:</td><td></td>
                    <td>Completed on:</td><td></td>
                </tr>
                <tr>
                    <td>Magnet link:</td><td></td>
                    <td>Labels:</td><td></td>
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
                        <Row className="bg-light">Transfer</Row>
                        <TransferTable {...props} />
                        <Row className="bg-light">Torrent</Row>
                        <TorrentTable {...props} />
                    </Container>
                </div>
            </div>
        </div>
    );
}

export function Details(props: DetailsProps) {
    if (!props.torrent) return <div></div>;

    return (
        <Container fluid className="d-flex flex-column h-100">
            <Tab.Container id="details-tabs" defaultActiveKey="general">
                <Nav variant="tabs">
                    <Nav.Link eventKey="general">General</Nav.Link>
                    <Nav.Link eventKey="files">{`Files (${props.torrent.files.length})`}</Nav.Link>
                    <Nav.Link eventKey="peers">Peers</Nav.Link>
                    <Nav.Link eventKey="trackers">Trackers</Nav.Link>
                    <Nav.Link eventKey="stats">Stats</Nav.Link>
                </Nav>
                <Tab.Content className="flex-grow-1">
                    <Tab.Pane eventKey="general" className="h-100">
                        <GeneralPane torrent={props.torrent} />
                    </Tab.Pane>
                    <Tab.Pane eventKey="files" className="h-100">
                        <Row className="h-100 scrollable">
                            <Container fluid>
                                {props.torrent.files.map(
                                    (file: any) => <Row key={file.name}>{file.name}</Row>)}
                            </Container>
                        </Row>
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
