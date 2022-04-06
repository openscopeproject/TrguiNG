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

import { Status } from "./transmission";

export interface Torrent extends Record<string, any> {

}

export function getTorrentError(t: Torrent): string {
    var torrentError = t.errorString;
    var trackerError = "";
    var noTrackerError = false;

    for (var trackerStat of t.trackerStats) {
        var err = '';
        if (trackerStat.hasAnnounced && !trackerStat.lastAnnounceSucceeded)
            err = trackerStat.lastAnnounceResult;
        if (!err || err == "Success") {
            noTrackerError = true;
        } else {
            // If the torrent error string is equal to some tracker error string,
            // then igonore the global error string
            if (err == torrentError) torrentError = "";
            trackerError = `Tracker: ${err}`;
        }
    }
    // if (t.name == "Koroshi Ai") {
    //     console.log(t.trackerStats.map(
    //         (s: any) => { return [s.hasAnnounced, s.lastAnnounceSucceeded, s.lastAnnounceResult] }));
    //     console.log(`${noTrackerError} ${torrentError} ${trackerError}`)
    // }

    if (noTrackerError || t.status == Status.stopped)
        return torrentError;
    else
        return trackerError;
}
