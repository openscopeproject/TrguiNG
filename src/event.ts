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

import { emit, listen, UnlistenFn } from "@tauri-apps/api/event";

export class EventListener {
    unlistenMap: Map<string, UnlistenFn> = new Map();

    add(event: string, callback: (payload: string) => void) {
        listen(event, (e) => callback(e.payload as string))
            .then((unlisten) => this.unlistenMap.set(event, unlisten));
    }

    remove(event: string) {
        var unlisten = this.unlistenMap.get(event);
        if (unlisten) unlisten();
        this.unlistenMap.delete(event);
    }

    finalize() {
        emit("listener-start", {}).then(() => {});
    }
}
