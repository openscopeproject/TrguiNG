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

// See https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md
// and https://github.com/transmission/transmission/blob/main/libtransmission/transmission.h

export const Status = {
    stopped: 0,
    queuedToVerify: 1,
    verifying: 2,
    queuedToDownload: 3,
    downloading: 4,
    queuedToSeed: 5,
    seeding: 6,
};

export const StatusStrings = [
    "Stopped",
    "Waiting",
    "Verifying",
    "Waiting",
    "Downloading",
    "Waiting",
    "Seeding",
];

export const Priority = {
    low: -1,
    normal: 0,
    high: 1,
};

export const PriorityStrings = new Map<number, string>([
    [-1, "Low"],
    [0, "Normal"],
    [1, "High"],
]);

export const PriorityColors = new Map<number, string>([
    [-1, "warning"],
    [0, "success"],
    [1, "danger"],
]);

export const TorrentFields = [
    "activityDate", //number tr_stat
    "addedDate", //number tr_stat
    "bandwidthPriority", //number tr_priority_t
    "corruptEver", //number tr_stat
    "dateCreated", //number tr_torrent_view
    "desiredAvailable", //number tr_stat
    "doneDate", //number tr_stat
    "downloadDir", //string tr_torrent
    "downloadedEver", //number tr_stat
    "downloadLimit", //number tr_torrent
    "downloadLimited", //boolean tr_torrent
    "editDate", //number tr_stat
    "error", //number tr_stat
    "errorString", //string tr_stat
    "eta", //number tr_stat
    "etaIdle", //number tr_stat
    "file-count", //number tr_info
    "group", //string", //n/a
    "haveUnchecked", //number tr_stat
    "haveValid", //number tr_stat
    "honorsSessionLimits", //boolean tr_torrent
    "id", //number tr_torrent
    "isFinished", //boolean tr_stat
    "isPrivate", //boolean tr_torrent
    "isStalled", //boolean tr_stat
    "labels", //array of strings tr_torrent
    "leftUntilDone", //number tr_stat
    "manualAnnounceTime", //number tr_stat
    "maxConnectedPeers", //number tr_torrent
    "metadataPercentComplete", //double tr_stat
    "name", //string tr_torrent_view
    "peer-limit", //number tr_torrent
    "peersConnected", //number tr_stat
    "peersGettingFromUs", //number tr_stat
    "peersSendingToUs", //number tr_stat
    "percentComplete", //double tr_stat
    "percentDone", //double tr_stat
    "pieceCount", //number tr_torrent_view
    "pieceSize", //number tr_torrent_view
    "queuePosition", //number tr_stat
    "rateDownload", //number tr_stat
    "rateUpload", //number tr_stat
    "recheckProgress", //double tr_stat
    "secondsDownloading", //number tr_stat
    "secondsSeeding", //number tr_stat
    "seedIdleLimit", //number tr_torrent
    "seedIdleMode", //number tr_inactvelimit
    "seedRatioLimit", //double tr_torrent
    "seedRatioMode", //number tr_ratiolimit
    "sizeWhenDone", //number tr_stat
    "startDate", //number tr_stat
    "status", //number (see below) tr_stat
    "totalSize", //number tr_torrent_view
    "torrentFile", //string tr_info
    "trackerStats", //array (see below)", //n/a
    "uploadedEver", //number tr_stat
    "uploadLimit", //number tr_torrent
    "uploadLimited", //boolean tr_torrent
    "uploadRatio", //double tr_stat
    "webseedsSendingToUs", //number tr_stat
] as const;

export type TorrentFieldsType = typeof TorrentFields[number];

export const TorrentAllFields = [
    ...TorrentFields,
    "comment", //string tr_torrent_view
    "creator", //string tr_torrent_view
    "files", //array (see below)", //n/a
    "fileStats", //array (see below)", //n/a
    "hashString", //string tr_torrent_view
    "magnetLink", //string", //n/a
    "peers", //array (see below)", //n/a
    "peersFrom", //object (see below)", //n/a
    "pieces", //string (see below) tr_torrent
    "priorities", //array (see below)", //n/a
    "primary-mime-type", //string tr_torrent
    "trackers", //array (see below)", //n/a
    "trackerList", //strings of announce URLs, one per line, with a blank line between tiers
    "wanted", //array (see below)", //n/a
    "webseeds", //array of strings tr_tracker_view
] as const;

export type TorrentAllFieldsType = typeof TorrentAllFields[number];
