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

import type { ServerConfig } from "config";
import { Duration } from "luxon";
import { useReducer } from "react";

const SISuffixes = ["B", "KB", "MB", "GB", "TB"];

export function bytesToHumanReadableStr(value: number): string {
    let unit = "";
    let divisor = 1.0;

    for (unit of SISuffixes) {
        if (value < 1024 * divisor) break;
        divisor *= 1024;
    }

    const tmp = value / divisor;

    let fp = 2;
    if (tmp > 100) fp = 1;
    if (tmp > 1000) fp = 0;

    return `${tmp.toFixed(fp)} ${unit}`;
}

export function byteRateToHumanReadableStr(value: number): string {
    if (value < 0) return "∞";
    else return `${bytesToHumanReadableStr(value)}/s`;
}

export function secondsToHumanReadableStr(value: number): string {
    let duration = Duration.fromMillis(value * 1000).shiftTo("days", "hours", "minutes", "seconds");
    // Make it coarse
    if (duration.days >= 100) duration = duration.set({ hours: 0, minutes: 0, seconds: 0 });
    else if (duration.days >= 10) duration = duration.set({ minutes: 0, seconds: 0 });
    else if (duration.days > 0 || duration.hours >= 10) duration = duration.set({ seconds: 0 });
    let s = "";
    if (duration.days > 0) s = `${duration.days}d`;
    if (duration.hours > 0) s = (s !== "" ? s + " " : "") + `${duration.hours}hr`;
    if (duration.minutes > 0) s = (s !== "" ? s + " " : "") + `${duration.minutes}min`;
    if (duration.seconds > 0) s = (s !== "" ? s + " " : "") + `${duration.seconds}s`;
    return s;
}

export function timestampToDateString(value: number): string {
    return new Date(value * 1000).toLocaleString();
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
    let p = path.replace(/\\/g, "/");
    if (p.match(/^[a-zA-Z]:\//) != null) p = p.toLowerCase();
    return p;
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
