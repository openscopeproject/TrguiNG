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

import { join } from "lodash";
import React, { CSSProperties, useEffect, useMemo, useRef } from "react";
import { Container, Form, Nav, Row, Tab, Table } from "react-bootstrap";
import { useResizeDetector } from "react-resize-detector";
import { getTorrentError, Torrent } from "../rpc/torrent";
import { bytesToHumanReadableStr, ensurePathDelimiter, secondsToHumanReadableStr, timestampToDateString } from "../util";
import { ProgressBar } from "./progressbar";
import { DateField, EtaField, LabelsField, StatusField, TrackerField } from "./torrenttable";

interface DetailsProps {
    torrent?: Torrent;
}

function DownloadBar(props: { torrent: Torrent }) {
    // temporarily just a progress bar
    const now = Math.round(props.torrent.percentDone * 1000);
    const nowStr = `${Math.floor(now / 10.0)}.${now % 10}%`;
    return (
        <div className="d-flex py-1 align-items-center">
            <div className="me-2">Downloaded:</div>
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

function PiecesCanvas(props: { torrent: Torrent }) {
    const { width, height, ref } = useResizeDetector({
        refreshMode: "throttle",
        refreshRate: 1000,
    });

    const piecesRef = useRef<HTMLCanvasElement>(null);
    const gridRef = useRef<HTMLCanvasElement>(null);

    const wantedPieces = useMemo(() => {
        var result: Array<boolean> = new Array(props.torrent.pieceCount);

        const pieceSize = props.torrent.pieceSize;
        const lengths = props.torrent.files.map((f: any) => f.length);
        const wanted = props.torrent.fileStats.map((f: any) => f.wanted);

        var fileIndex = 0;
        var pieceIndex = 0;
        var totalLength = 0;

        while (totalLength < props.torrent.totalSize) {
            totalLength += lengths[fileIndex];
            while ((pieceIndex + 1) * pieceSize < totalLength) {
                result[pieceIndex] = result[pieceIndex] || wanted[fileIndex];
                pieceIndex++;
            }
            result[pieceIndex] = result[pieceIndex] || wanted[fileIndex];
            if ((pieceIndex + 1) * pieceSize == totalLength) pieceIndex++;
            fileIndex++;
        }

        return result;
    }, [props.torrent]);

    const [pieceSize, rows, cols] = useMemo(() => {
        if (width === undefined || height === undefined) return [5, 1, 1];

        const check = (size: number) => {
            var cols = Math.floor(width / size);
            var rows = Math.ceil(props.torrent.pieceCount / cols);
            if (rows * size < height) return [rows, cols];
            else return [-1, -1];
        }
        var right = 20;
        var left = 0.0;
        var mid = 10;
        var rows = 1;
        var cols = 1;

        while (right - left > 0.2) {
            [rows, cols] = check(mid);
            if (rows < 0) right = mid;
            else left = mid;
            mid = (right + left) * 0.5;
        }
        return [left, ...check(left)];
    }, [props.torrent.pieceCount, width, height]);

    const pieces = useMemo(() => {
        const bstr = window.atob(props.torrent.pieces);
        var bytes = new Uint8Array(bstr.length);
        for (var i = 0; i < bstr.length; i++) {
            bytes[i] = bstr.charCodeAt(i);
        }
        return bytes;
    }, [props]);

    useEffect(() => {
        var canvas = gridRef.current!;
        var ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const remainder = rows * cols - props.torrent.pieceCount;

        ctx.beginPath();
        ctx.lineWidth = pieceSize > 5 ? 1 : 0.5;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        for (var i = 0; i < rows; i++) {
            ctx.moveTo(0, i * pieceSize);
            ctx.lineTo(cols * pieceSize, i * pieceSize);
        }
        ctx.moveTo(0, rows * pieceSize);
        ctx.lineTo((cols - remainder) * pieceSize, i * pieceSize);
        for (var i = 0; i <= cols - remainder; i++) {
            ctx.moveTo(i * pieceSize, 0);
            ctx.lineTo(i * pieceSize, rows * pieceSize);
        }
        for (var i = cols - remainder + 1; i <= cols; i++) {
            ctx.moveTo(i * pieceSize, 0);
            ctx.lineTo(i * pieceSize, (rows - 1) * pieceSize);
        }
        ctx.stroke();
    }, [gridRef, rows, cols, width, height]);

    useEffect(() => {
        const canvas = piecesRef.current!;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var r = 0; r < rows; r++) {
            var index = 0;
            for (var c = 0; c < cols; c++) {
                index = r * cols + c;
                if (index >= props.torrent.pieceCount) break;
                var have = pieces[Math.floor(index / 8)] & (0b10000000 >> (index % 8));
                ctx.fillStyle = have ? "steelblue" : wantedPieces[index] ? "paleturquoise" : "silver";
                ctx.fillRect(c * pieceSize, r * pieceSize, pieceSize, pieceSize);
            }
            if (index >= props.torrent.pieceCount) break;
        }

    }, [piecesRef, rows, cols, pieceSize, pieces, wantedPieces]);

    const dw = Math.floor(window.devicePixelRatio * (width || 1));
    const dh = Math.floor(window.devicePixelRatio * (height || 1));
    const style: CSSProperties = {
        width: width || 1, height: height || 1, position: "absolute", top: 0, left: 0
    };
    return (
        <div ref={ref} className="w-100 h-100 position-relative">
            <canvas ref={piecesRef} width={dw} height={dh} style={style} />
            <canvas ref={gridRef} width={dw} height={dh} style={style} />
        </div>
    )
}

export function Details(props: DetailsProps) {
    if (!props.torrent) return <div className="p-3">Select a torrent to view it's details</div>;

    return (
        <Container fluid className="d-flex flex-column h-100">
            <Tab.Container id="details-tabs" defaultActiveKey="general">
                <Nav variant="tabs">
                    <Nav.Link eventKey="general">General</Nav.Link>
                    <Nav.Link eventKey="files">{`Files (${props.torrent.files.length})`}</Nav.Link>
                    <Nav.Link eventKey="pieces">{`Pieces (${props.torrent.pieceCount})`}</Nav.Link>
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
                    <Tab.Pane eventKey="pieces" className="h-100">
                        <PiecesCanvas torrent={props.torrent} />
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
