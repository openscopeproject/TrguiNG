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

import type { ExtendedCustomColors } from "types/mantine";

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
} as const;

export const StatusStrings = [
    "Stopped",
    "Waiting",
    "Verifying",
    "Waiting",
    "Downloading",
    "Waiting",
    "Seeding",
] as const;

export type PriorityNumberType = -1 | 0 | 1;

export const BandwidthPriority = {
    low: -1,
    normal: 0,
    high: 1,
} as const;

export const PriorityStrings = new Map<PriorityNumberType, string>([
    [-1, "Low"],
    [0, "Normal"],
    [1, "High"],
]);

export const PriorityColors = new Map<PriorityNumberType, ExtendedCustomColors>([
    [-1, "yellow.6"],
    [0, "teal"],
    [1, "orange.7"],
]);

export const TorrentMinimumFields = [
    "id", // number tr_torrent
    "name", // string tr_torrent_view
    // following are needed by filters
    "status", // number (see below) tr_stat
    "pieceCount", // number tr_torrent_view
    "downloadDir", // string tr_torrent
    "labels", // array of strings tr_torrent
    // following are needed to get torrent error status
    "error", // number tr_stat
    "errorString", // string tr_stat
    "trackerStats", // array (see below)", //n/a
    // for copy magnet links menu
    "magnetLink",
    // following are needed by status bar
    "rateDownload", // number tr_stat
    "rateUpload", // number tr_stat
    "sizeWhenDone", // number tr_stat
    "haveValid", // number tr_stat
] as const;

export const TorrentFields = [
    ...TorrentMinimumFields,
    "activityDate", // number tr_stat
    "addedDate", // number tr_stat
    "bandwidthPriority", // number tr_priority_t
    "corruptEver", // number tr_stat
    "dateCreated", // number tr_torrent_view
    "desiredAvailable", // number tr_stat
    "doneDate", // number tr_stat
    "downloadedEver", // number tr_stat
    "downloadLimit", // number tr_torrent
    "downloadLimited", // boolean tr_torrent
    "editDate", // number tr_stat
    "eta", // number tr_stat
    "etaIdle", // number tr_stat
    "file-count", // number tr_info
    "group", // string
    "hashString", // string tr_torrent_view
    "haveUnchecked", // number tr_stat
    "honorsSessionLimits", // boolean tr_torrent
    "isFinished", // boolean tr_stat
    "isPrivate", // boolean tr_torrent
    "isStalled", // boolean tr_stat
    "leftUntilDone", // number tr_stat
    "manualAnnounceTime", // number tr_stat
    "maxConnectedPeers", // number tr_torrent
    "metadataPercentComplete", // double tr_stat
    "peer-limit", // number tr_torrent
    "peersConnected", // number tr_stat
    "peersGettingFromUs", // number tr_stat
    "peersSendingToUs", // number tr_stat
    "percentComplete", // double tr_stat
    "percentDone", // double tr_stat
    "pieceSize", // number tr_torrent_view
    "queuePosition", // number tr_stat
    "recheckProgress", // double tr_stat
    "secondsDownloading", // number tr_stat
    "secondsSeeding", // number tr_stat
    "seedIdleLimit", // number tr_torrent
    "seedIdleMode", // number tr_inactvelimit
    "seedRatioLimit", // double tr_torrent
    "seedRatioMode", // number tr_ratiolimit
    "sequentialDownload", // boolean download torrent pieces sequentially
    "startDate", // number tr_stat
    "totalSize", // number tr_torrent_view
    "torrentFile", // string tr_info
    "uploadedEver", // number tr_stat
    "uploadLimit", // number tr_torrent
    "uploadLimited", // boolean tr_torrent
    "uploadRatio", // double tr_stat
    "webseedsSendingToUs", // number tr_stat
] as const;

export type TorrentFieldsType = typeof TorrentFields[number];

// These fields should not be in main table because they take up a lot of data
export const TorrentAllFields = [
    ...TorrentFields,
    "comment", // string tr_torrent_view
    "creator", // string tr_torrent_view
    "files", // array (see below)", //n/a
    "fileStats", // array (see below)", //n/a
    "peers", // array (see below)", //n/a
    "peersFrom", // object (see below)", //n/a
    "pieces", // string (see below) tr_torrent
    "priorities", // array (see below)", //n/a
    "primary-mime-type", // string tr_torrent
    "trackers", // array (see below)", //n/a
    "trackerList", // strings of announce URLs, one per line, with a blank line between tiers
    "wanted", // array (see below)", //n/a
    "webseeds", // array of strings tr_tracker_view
] as const;

export type TorrentAllFieldsType = typeof TorrentAllFields[number];

export const TorrentMutableFields = [
    "bandwidthPriority", // number this torrent's bandwidth tr_priority_t
    "downloadLimit", // number maximum download speed (KBps)
    "downloadLimited", // boolean true if downloadLimit is honored
    "files-unwanted", // array indices of file(s) to not download
    "files-wanted", // array indices of file(s) to download
    "group", // string The name of this torrent's bandwidth group
    "honorsSessionLimits", // boolean true if session upload limits are honored
    "labels", // array array of string labels
    "location", // string new location of the torrent's content
    "peer-limit", // number maximum number of peers
    "priority-high", // array indices of high-priority file(s)
    "priority-low", // array indices of low-priority file(s)
    "priority-normal", // array indices of normal-priority file(s)
    "queuePosition", // number position of this torrent in its queue [0...n)
    "seedIdleLimit", // number torrent-level number of minutes of seeding inactivity
    "seedIdleMode", // number which seeding inactivity to use. See tr_idlelimit
    "seedRatioLimit", // double torrent-level seeding ratio
    "seedRatioMode", // number which ratio to use. See tr_ratiolimit
    "sequentialDownload", // boolean download torrent pieces sequentially
    "trackerAdd", // array DEPRECATED use trackerList instead
    "trackerList", // string string of announce URLs, one per line, and a blank line between tiers.
    "trackerRemove", // array DEPRECATED use trackerList instead
    "trackerReplace", // array DEPRECATED use trackerList instead
    "uploadLimit", // number maximum upload speed (KBps)
    "uploadLimited", // boolean true if uploadLimit is honored
] as const;

export type TorrentMutableFieldsType = typeof TorrentMutableFields[number];

export const TorrentFileFields = [
    "bytesCompleted", // number tr_file_view
    "length", // number tr_file_view
    "name", // string tr_file_view
] as const;

export type TorrentFileFieldsType = typeof TorrentFileFields[number];

// These fields are polled regularlly with torrent list
export const SessionFields = [
    "alt-speed-down", // number: max global download speed (KBps)
    "alt-speed-enabled", // boolean: true means use the alt speeds
    "alt-speed-up", // number: max global upload speed (KBps)
    "download-dir-free-space", // number: DEPRECATED Use the free-space method instead.
    "speed-limit-down-enabled", // boolean: true means enabled
    "speed-limit-down", // number: max global download speed (KBps)
    "speed-limit-up-enabled", // boolean: true means enabled
    "speed-limit-up", // number: max global upload speed (KBps)
] as const;

export type SessionFieldsType = typeof SessionFields[number];

// These fields are polled once per session or when config is updated
export const SessionAllFields = [
    ...SessionFields,
    "alt-speed-time-begin", // number: when to turn on alt speeds (units: minutes after midnight)
    "alt-speed-time-day", // number: what day(s) to turn on alt speeds (look at tr_sched_day)
    "alt-speed-time-enabled", // boolean: true means the scheduled on/off times are used
    "alt-speed-time-end", // number: when to turn off alt speeds (units: same)
    "blocklist-enabled", // boolean: true means enabled
    "blocklist-size", // number: number of rules in the blocklist
    "blocklist-url", // string: location of the blocklist to use for blocklist-update
    "cache-size-mb", // number: maximum size of the disk cache (MB)
    "config-dir", // string: location of transmission's configuration directory
    "default-trackers", // list of default trackers to use on public torrents
    "dht-enabled", // boolean: true means allow dht in public torrents
    "download-dir", // string: default path to download torrents
    "download-queue-enabled", // boolean: if true, limit how many torrents can be downloaded at once
    "download-queue-size", // number: max number of torrents to download at once (see download-queue-enabled)
    "encryption", // string: required, preferred, tolerated
    "idle-seeding-limit-enabled", // boolean: true if the seeding inactivity limit is honored by default
    "idle-seeding-limit", // number: torrents we're seeding will be stopped if they're idle for this long
    "incomplete-dir-enabled", // boolean: true means keep torrents in incomplete-dir until done
    "incomplete-dir", // string: path for incomplete torrents, when enabled
    "lpd-enabled", // boolean: true means allow Local Peer Discovery in public torrents
    "peer-limit-global", // number: maximum global number of peers
    "peer-limit-per-torrent", // number: maximum global number of peers
    "peer-port-random-on-start", // boolean: true means pick a random peer port on launch
    "peer-port", // number: port number
    "pex-enabled", // boolean: true means allow pex in public torrents
    "port-forwarding-enabled", // boolean: true means ask upstream router to forward the configured peer port to transmission using UPnP or NAT-PMP
    "queue-stalled-enabled", // boolean: whether or not to consider idle torrents as stalled
    "queue-stalled-minutes", // number: torrents that are idle for N minuets aren't counted toward seed-queue-size or download-queue-size
    "rename-partial-files", // boolean: true means append .part to incomplete files
    "rpc-version-minimum", // number: the minimum RPC API version supported
    "rpc-version-semver", // number: the current RPC API version in a semver-compatible string
    "rpc-version", // number: the current RPC API version
    "script-torrent-added-enabled", // boolean: whether or not to call the added script
    "script-torrent-added-filename", // string: filename of the script to run
    "script-torrent-done-enabled", // boolean: whether or not to call the done script
    "script-torrent-done-filename", // string: filename of the script to run
    "script-torrent-done-seeding-enabled", // boolean: whether or not to call the seeding-done script
    "script-torrent-done-seeding-filename", // string: filename of the script to run
    "seed-queue-enabled", // boolean: if true, limit how many torrents can be uploaded at once
    "seed-queue-size", // number: max number of torrents to uploaded at once (see seed-queue-enabled)
    "seedRatioLimit", // double: the default seed ratio for torrents to use
    "seedRatioLimited", // boolean: true if seedRatioLimit is honored by default
    "start-added-torrents", // boolean: true means added torrents will be started right away
    "trash-original-torrent-files", // boolean: true means the .torrent file of added torrents will be deleted
    "units", // object: see below
    "utp-enabled", // boolean: true means allow utp
    "version", // string: long version string $version ($revision)
] as const;

export type SessionAllFieldsType = typeof SessionAllFields[number];

export const TrackerStatsFields = [
    "announceState", // number
    "announce", // string
    "downloadCount", // number
    "hasAnnounced", // boolean
    "hasScraped", // boolean
    "host", // string
    "id", // number
    "isBackup", // boolean
    "lastAnnouncePeerCount", // number
    "lastAnnounceResult", // string
    "lastAnnounceStartTime", // number
    "lastAnnounceSucceeded", // boolean
    "lastAnnounceTime", // number
    "lastAnnounceTimedOut", // boolean
    "lastScrapeResult", // string
    "lastScrapeStartTime", // number
    "lastScrapeSucceeded", // boolean
    "lastScrapeTime", // number
    "lastScrapeTimedOut", // boolean
    "leecherCount", // number
    "nextAnnounceTime", // number
    "nextScrapeTime", // number
    "scrapeState", // number
    "scrape", // string
    "seederCount", // number
    "sitename", // string
] as const;

export type TrackerStatsFieldsType = typeof TrackerStatsFields[number];

export const PeerStatsFields = [
    "address", // string
    "clientName", // string
    "clientIsChoked", // boolean
    "clientIsInterested", // boolean
    "flagStr", // string
    "isDownloadingFrom", // boolean
    "isEncrypted", // boolean
    "isIncoming", // boolean
    "isUploadingTo", // boolean
    "isUTP", // boolean
    "peerIsChoked", // boolean
    "peerIsInterested", // boolean
    "port", // number
    "progress", // double
    "rateToClient", // (B/s) number
    "rateToPeer", // (B/s) number
] as const;

export type PeerStatsFieldsType = typeof PeerStatsFields[number];

export interface SessionStatEntry {
    uploadedBytes: number,
    downloadedBytes: number,
    filesAdded: number,
    sessionCount: number,
    secondsActive: number,
}

export interface SessionStatistics {
    "cumulative-stats": SessionStatEntry,
    "current-stats": SessionStatEntry,
}

export const BandwidthGroupFields = [
    "honorsSessionLimits", // boolean true if session upload limits are honored
    "name", // string Bandwidth group name
    "speed-limit-down-enabled", // boolean true means enabled
    "speed-limit-down", // number max global download speed (KBps)
    "speed-limit-up-enabled", // boolean true means enabled
    "speed-limit-up number", // max global upload speed (KBps)
] as const;

export type BandwidthGroupFieldType = typeof BandwidthGroupFields[number];
