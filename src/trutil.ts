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

import type { Config, ServerConfig } from "config";
import { useReducer } from "react";
import type { ProgressBarVariant } from "./components/progressbar";
import { Status } from "rpc/transmission";
import type { Torrent } from "rpc/torrent";
import { formatDate } from "date-fns";

const SIUnits = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB"];

export function bytesToHumanReadableStr(value: number): string {
    let unit = "";
    let divisor = 1.0;

    for (unit of SIUnits) {
        if (value < 1024 * divisor) break;
        divisor *= 1024;
    }

    const tmp = value / divisor;

    let fp = 2;
    if (tmp >= 100) fp = 1;
    if (tmp >= 1000) fp = 0;
    if (unit === "B") fp = 0;

    return `${tmp.toFixed(fp)} ${unit}`;
}

export function byteRateToHumanReadableStr(value: number): string {
    if (value < 0) return "∞";
    else return `${bytesToHumanReadableStr(value)}/s`;
}

export function secondsToHumanReadableStr(value: number): string {
    let duration = {
        days: Math.floor(value / 86400),
        hours: Math.floor(value / 3600) % 24,
        minutes: Math.floor(value / 60) % 60,
        seconds: value % 60,
    };
    // Make it coarse
    if (duration.days >= 10) duration = { days: duration.days, hours: 0, minutes: 0, seconds: 0 };
    else if (duration.days > 0) duration = { ...duration, minutes: 0, seconds: 0 };
    else if (duration.days > 0 || duration.hours > 0) duration.seconds = 0;
    let s = "";
    if (duration.days > 0) s = `${duration.days}d`;
    if (duration.hours > 0) s = (s !== "" ? s + " " : "") + `${duration.hours}hr`;
    if (duration.minutes > 0) s = (s !== "" ? s + " " : "") + `${duration.minutes}min`;
    if (duration.seconds > 0) s = (s !== "" ? s + " " : "") + `${duration.seconds}s`;
    return s;
}

export function timestampToDateString(value: number, config: Config): string {
    if (value === 0) return "-";
    const date = new Date(value * 1000);
    if (config.values.interface.useCustomDateTimeFormat) {
        const dateFormat = config.values.interface.dateFormat.replace("mm", "MM");
        const timeFormat = config.values.interface.timeFormat === "12h" ? "hh:mm:ss a" : "HH:mm:ss";
        return `${formatDate(date, dateFormat)} ${formatDate(date, timeFormat)}`;
    } else {
        return date.toLocaleString();
    }
}

export function ensurePathDelimiter(path: string): string {
    if (path.length === 0) return "";
    let delimiter = "/";
    if (path.includes("\\")) delimiter = "\\";
    if (path.charAt(path.length - 1) !== delimiter) {
        return path + delimiter;
    }
    return path;
}

export function useForceRender() {
    const [, forceRender] = useReducer((oldVal: number) => oldVal + 1, 0);
    return forceRender;
}

export function swapElements(a: unknown[], i: number, j: number) {
    if (i >= 0 && i < a.length && j >= 0 && j < a.length && i !== j) {
        [a[i], a[j]] = [a[j], a[i]];
    }
}

export function reorderElements<T>(list: T[], startIndex: number, endIndex: number): T[] {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    return result;
}

function normalizePath(path: string) {
    return path.replace(/\\/g, "/");
}

export function pathMapFromServer(path: string, config: ServerConfig) {
    let mappedPath = path;
    const normalizedPath = normalizePath(path);
    for (const mapping of config.pathMappings) {
        if (mapping.from.length > 0 && normalizedPath.startsWith(normalizePath(mapping.from))) {
            mappedPath = mapping.to + mappedPath.substring(mapping.from.length);
            break;
        }
    }
    return mappedPath;
}

export function pathMapToServer(path: string, config: ServerConfig) {
    let mappedPath = path;
    const normalizedPath = normalizePath(path);
    for (const mapping of config.pathMappings) {
        if (mapping.to.length > 0 && normalizedPath.startsWith(normalizePath(mapping.to))) {
            mappedPath = mapping.from + mappedPath.substring(mapping.to.length);
            break;
        }
    }
    return mappedPath;
}

export function eventHasModKey(event: React.MouseEvent<Element> | React.KeyboardEvent<Element>) {
    return (navigator.platform.startsWith("Mac") && event.metaKey) ||
        (!navigator.platform.startsWith("Mac") && event.ctrlKey);
}

export function modKeyString() {
    return navigator.platform.startsWith("Mac") ? "⌘" : "ctrl";
}

export function decodeMagnetLink(magnet: string) {
    const params = magnet.substring(8).split("&").map((p) => {
        const eqIndex = p.indexOf("=");
        return [p.substring(0, eqIndex), p.substring(eqIndex + 1)];
    });

    let hash = params.find((p) => p[0] === "xt")?.[1] ?? "";
    if (hash.startsWith("urn:btih:")) hash = hash.substring(9).toLowerCase();
    else hash = "";

    const trackers = params
        .filter((p) => p[0] === "tr" && p[1] !== "")
        .map((p) => decodeURIComponent(p[1]));

    return {
        hash,
        trackers,
    };
}

export function mergeTrackerLists(currentTrackers: string[][], newTrackers: string[][]) {
    const uniqueTrackers = new Set<string>();
    currentTrackers.forEach((tier) => { tier.forEach((tracker) => uniqueTrackers.add(tracker)); });

    const mergedTrackers = [...currentTrackers];

    newTrackers.forEach((tier, i) => {
        if (i >= mergedTrackers.length) {
            const filteredTier = tier.filter((tracker) => !uniqueTrackers.has(tracker));
            if (filteredTier.length > 0) {
                mergedTrackers.push(filteredTier);
                filteredTier.forEach((tracker) => uniqueTrackers.add(tracker));
            }
        } else {
            tier.forEach((tracker) => {
                if (!uniqueTrackers.has(tracker)) {
                    mergedTrackers[i].push(tracker);
                    uniqueTrackers.add(tracker);
                }
            });
        }
    });
    return mergedTrackers;
}

// This regex has some chars that are only invalid on windows but not linux/mac
// But we have to be safe and use them all to ensure that multi client
// environments where clients are on different OSes are interoperable.
const badChars = /[<>:"\\/|?*]/g;

export function fileSystemSafeName(name: string) {
    return name.replace(badChars, "_");
}

export function * chainedIterables<T>(...iterables: Array<Iterable<T>>) {
    for (const iterable of iterables) yield * iterable;
}

export function torrentProgressbarStyle(torrent: Torrent, config: Config) {
    const active = torrent.rateDownload > 0 || torrent.rateUpload > 0;
    const animate = config.values.interface.animatedProgressbars && active;

    let variant: ProgressBarVariant = "default";
    if (config.values.interface.colorfulProgressbars) {
        if ((torrent.error !== undefined && torrent.error > 0) || torrent.cachedError !== "") {
            variant = "red";
        } else {
            if (torrent.status === Status.stopped && torrent.sizeWhenDone > 0) {
                if (torrent.leftUntilDone === 0) {
                    variant = "dark-green";
                } else {
                    variant = "yellow";
                }
            } else if (torrent.status === Status.seeding) {
                variant = "green";
            } else if (torrent.status === Status.queuedToVerify ||
                torrent.status === Status.queuedToDownload ||
                torrent.status === Status.queuedToSeed) {
                variant = "grey";
            }
        }
    }

    return { animate, variant };
}

export function hasEllipsis(element: HTMLElement) {
    if (element == null) return false;

    let scrollWidth = element.scrollWidth;

    element.style.width = "max-content";
    const itemRects = element.getClientRects();

    if (itemRects.length > 0 && itemRects[0].width > scrollWidth) {
        scrollWidth = itemRects[0].width;
    }

    element.style.width = "auto";
    return scrollWidth > element.clientWidth;
}
