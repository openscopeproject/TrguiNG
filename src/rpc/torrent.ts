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

import type { BandwidthGroupFieldType, PeerStatsFieldsType, TorrentAllFieldsType, TrackerStatsFieldsType } from "./transmission";
import { Status } from "./transmission";
import { useRef, useEffect } from "react";

export type Torrent = Partial<Record<TorrentAllFieldsType, any>>;
export type TrackerStats = Partial<Record<TrackerStatsFieldsType, any>>;
export type PeerStats = Partial<Record<PeerStatsFieldsType, any>>;
export type BandwidthGroup = Record<BandwidthGroupFieldType, any>;

export function getTorrentError(t: Torrent): string {
    let torrentError = t.errorString;
    let trackerError = "";
    let noTrackerError = false;

    for (const trackerStat of t.trackerStats) {
        let err = "";
        if (trackerStat.hasAnnounced as boolean && !(trackerStat.lastAnnounceSucceeded as boolean)) {
            err = trackerStat.lastAnnounceResult as string;
        }
        if (err === "" || err === "Success") {
            noTrackerError = true;
        } else {
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

export interface ServerTorrentData {
    torrents: Torrent[],
    selected: Set<number>,
    current: number | undefined,
    allLabels: string[],
}

export function useServerTorrentData(torrents: Torrent[], selectedTorrents: Set<number>, currentTorrent: number | undefined, allLabels: string[]) {
    const serverData = useRef<ServerTorrentData>({
        torrents: torrents ?? [],
        selected: selectedTorrents,
        current: currentTorrent,
        allLabels,
    });

    useEffect(() => {
        serverData.current = {
            torrents: torrents ?? [],
            selected: selectedTorrents,
            current: currentTorrent,
            allLabels,
        };
    }, [torrents, selectedTorrents, currentTorrent, allLabels]);
    return serverData;
}
