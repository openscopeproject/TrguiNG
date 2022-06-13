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

import { Duration } from "luxon"
import { useReducer } from "react";

const SISuffixes = ["B", "KB", "MB", "GB", "TB"];

export function bytesToHumanReadableStr(value: number): string {
    var unit = "";
    var divisor = 1.0;

    for (var i in SISuffixes) {
        unit = SISuffixes[i];
        if (value < 1024 * divisor) break;
        divisor *= 1024;
    }

    var tmp = String(value / divisor);
    var result = tmp.includes(".") ? tmp.substring(0, 5) : tmp.substring(0, 3);

    return `${result} ${unit}`;
}

export function byteRateToHumanReadableStr(value: number): string {
    if (value < 0) return "∞";
    else return `${bytesToHumanReadableStr(value)}/s`;
}

export function secondsToHumanReadableStr(value: number): string {
    var duration = Duration.fromMillis(value * 1000).shiftTo("days", "hours", "minutes", "seconds");
    // Make it coarse
    if (duration.days >= 100) duration = duration.set({ hours: 0, minutes: 0, seconds: 0 });
    else if (duration.days >= 10) duration = duration.set({ minutes: 0, seconds: 0 });
    else if (duration.days > 0 || duration.hours >= 10) duration = duration.set({ seconds: 0 });
    var s = "";
    if (duration.days) s = `${duration.days}d`;
    if (duration.hours) s = (s ? s + " " : "") + `${duration.hours}hr`;
    if (duration.minutes) s = (s ? s + " " : "") + `${duration.minutes}min`;
    if (duration.seconds) s = (s ? s + " " : "") + `${duration.seconds}s`;
    return s;
}

export function timestampToDateString(value: number): string {
    return new Date(value * 1000).toLocaleString();
}

export function ensurePathDelimiter(path: string): string {
    if (path.length == 0) return "";
    var delimiter = '/';
    if (path.indexOf('\\') >= 0) delimiter = '\\';
    if (path.charAt(path.length - 1) != delimiter)
        return path + delimiter;
    return path;
}

export function useForceRender() {
    const [, forceRender] = useReducer((oldVal) => oldVal + 1, 0);
    return forceRender;
}

export function swapElements(a: Array<Object>, i: number, j: number) {
    if (i >= 0 && i < a.length && j >= 0 && j < a.length && i != j)
        [a[i], a[j]] = [a[j], a[i]];
}
