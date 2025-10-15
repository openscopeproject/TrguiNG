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

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { BandwidthGroupFieldType, PeerStatsFieldsType, TorrentAllFieldsType, TorrentFileFieldsType, TrackerStatsFieldsType } from "./transmission";
import { Status } from "./transmission";
import React, { useContext } from "react";
import type { TransmissionClient } from "./client";

export type TrackerStats = Partial<Record<TrackerStatsFieldsType, any>>;
export type BandwidthGroup = Record<BandwidthGroupFieldType, any>;
export type TorrentBase = Partial<Record<TorrentAllFieldsType, any>>;
export type TorrentFile = Record<TorrentFileFieldsType, any>;

export interface Torrent extends TorrentBase {
    cachedError: string,
    cachedTrackerStatus: string,
    cachedTrackerDlCount: number,
    cachedMainTracker: string,
    cachedPeersTotal: number,
    cachedSeedsTotal: number,
}

function getTorrentError(t: TorrentBase): string {
    let torrentError = t.errorString;
    let trackerError = "";
    let noTrackerError = false;

    for (const trackerStat of t.trackerStats) {
        if (trackerStat.isBackup as boolean) {
            continue;
        }
        let err = "";
        if (trackerStat.hasAnnounced as boolean && !(trackerStat.lastAnnounceSucceeded as boolean)) {
            err = trackerStat.lastAnnounceResult as string;
        }
        if (err === "" || err === "Success") {
            noTrackerError = true;
        } else if (trackerError === "") {
            // If the torrent error string is equal to some tracker error string,
            // then igonore the global error string
            if (err === torrentError) torrentError = "";
            trackerError = `Tracker: ${err}`;
        }
    }

    if (noTrackerError || t.status === Status.stopped) {
        return torrentError;
    } else {
        return trackerError;
    }
}

export function getTrackerAnnounceState(tracker: TrackerStats) {
    if (tracker.announceState === 3) return "Updating";
    if (tracker.hasAnnounced as boolean) {
        if (tracker.lastAnnounceSucceeded as boolean) return "Working";
        if (tracker.lastAnnounceResult === "Success") return "Working";
        return tracker.lastAnnounceResult;
    }
    return "";
}

function getTrackerStatus(torrent: TorrentBase): string {
    const trackers = torrent.trackerStats as TrackerStats[];
    if (torrent.status === Status.stopped || trackers.length === 0) return "";
    return getTrackerAnnounceState(trackers[0]);
}

function getTrackerDlCount(torrent: TorrentBase): number {
    const trackers = torrent.trackerStats as TrackerStats[];
    if (torrent.status === Status.stopped || trackers.length === 0) return -1;
    return trackers.map((t) => t.downloadCount as number).reduce((total, current) => total + current, 0) as number;
}

const portRe = /:\d+$/;
const httpRe = /^https?:\/\//;

function getTorrentMainTracker(t: TorrentBase, ignoredPrefixesRe: RegExp): string {
    if (t.trackerStats.length === 0) return "<No trackers>";
    let host = t.trackerStats[0].host as string;
    const portMatch = portRe.exec(host);
    if (portMatch != null) host = host.substring(0, portMatch.index);
    const prefixMatch = ignoredPrefixesRe.exec(host);
    if (prefixMatch?.groups !== undefined) host = host.substring(prefixMatch.groups.prefix.length + 1);
    const httpMatch = httpRe.exec(host);
    if (httpMatch != null) host = host.substring(httpMatch[0].length);
    return host;
}

function getSeedsTotal(t: TorrentBase) {
    let seeds = t.trackerStats.length > 0 ? 0 : -1;
    t.trackerStats.forEach(
        (tracker: TrackerStats) => { seeds = Math.max(seeds, tracker.seederCount as number); });
    return seeds;
}

function getPeersTotal(t: TorrentBase) {
    let peers = t.trackerStats.length > 0 ? 0 : -1;
    t.trackerStats.forEach(
        (tracker: TrackerStats) => { peers = Math.max(peers, tracker.leecherCount as number); });
    return peers;
}

export async function processTorrent(t: TorrentBase, lookupIps: boolean, ignoredPrefixesRe: RegExp, client: TransmissionClient): Promise<Torrent> {
    const peers = t.peers === undefined
        ? undefined
        : await Promise.all(t.peers.map(async (p: PeerStatsBase) => await processPeerStats(p, lookupIps, client)));

    return {
        ...t,
        downloadDir: (t.downloadDir as string).replaceAll("\\", "/"),
        cachedError: getTorrentError(t),
        cachedTrackerStatus: getTrackerStatus(t),
        cachedTrackerDlCount: getTrackerDlCount(t),
        cachedMainTracker: getTorrentMainTracker(t, ignoredPrefixesRe),
        cachedSeedsTotal: getSeedsTotal(t),
        cachedPeersTotal: getPeersTotal(t),
        peers,
    };
}

export interface ServerTorrentData {
    torrents: Torrent[],
    current: number | undefined,
}

export const ServerTorrentDataContext = React.createContext<ServerTorrentData>({
    torrents: [],
    current: undefined,
});

export function useServerTorrentData() {
    return useContext(ServerTorrentDataContext);
}

export const ServerRpcVersionContext = React.createContext<number>(0);

export function useServerRpcVersion() {
    return useContext(ServerRpcVersionContext);
}

export const ServerSelectedTorrentsContext = React.createContext<Set<number>>(new Set());

export function useServerSelectedTorrents() {
    return useContext(ServerSelectedTorrentsContext);
}

type PeerStatsBase = Partial<Record<PeerStatsFieldsType, any>>;

export interface PeerStats extends PeerStatsBase {
    cachedEncrypted: string,
    cachedFrom: string,
    cachedConnection: string,
    cachedProtocol: string,
    cachedStatus: string,
    cachedCountryIso?: string,
    cachedCountryName?: string,
}

// Flag meanings: https://github.com/transmission/transmission/blob/main/docs/Peer-Status-Text.md

const statusFlagStrings = {
    O: "optimistic",
    D: "downloading",
    d: "can download from",
    U: "uploading",
    u: "can upload to",
    K: "not interested",
    "?": "peer not interested",
} as const;

async function processPeerStats(peer: PeerStatsBase, lookupIps: boolean, client: TransmissionClient): Promise<PeerStats> {
    const flags = peer.flagStr as string;

    const cachedFrom = flags.includes("X")
        ? "PEX"
        : flags.includes("H")
            ? "DHT"
            : "Tracker";

    const status = [...flags.matchAll(/[ODdUuK?]/g)].map(
        (s) => statusFlagStrings[s[0] as keyof (typeof statusFlagStrings)]);

    const country = lookupIps
        ? await client.ipsBatcher.fetch(peer.address)
        : undefined;

    return {
        ...peer,
        cachedEncrypted: flags.includes("E") ? "yes" : "no",
        cachedFrom,
        cachedConnection: flags.includes("I") ? "incoming" : "outgoing",
        cachedProtocol: flags.includes("T") ? "µTP" : "TCP",
        cachedStatus: (status ?? []).join(", "),
        cachedCountryIso: country?.isoCode,
        cachedCountryName: country?.name,
    };
}
