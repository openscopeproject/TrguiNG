import { Duration } from "luxon"

export const scrollbarWidth = () => {
    // thanks too https://davidwalsh.name/detect-scrollbar-width
    const scrollDiv = document.createElement('div')
    scrollDiv.setAttribute('style', 'width: 100px; height: 100px; overflow: scroll; position:absolute; top:-9999px;')
    document.body.appendChild(scrollDiv)
    const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
    document.body.removeChild(scrollDiv)
    return scrollbarWidth
}

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
