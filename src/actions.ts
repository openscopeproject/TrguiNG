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

import { BandwidthPriority, PriorityNumberType } from "rpc/transmission";
import { TorrentActionMethodsType, TransmissionClient } from "./rpc/client";

const ActionMethods = [
    "resume",
    "pause",
    "delete",
    "moveQueueUp",
    "moveQueueDown",
    "changeDirectory",
    "setLabels",
    "setPriority",
    "setAltSpeedMode",
    "verify",
    "reannounce",
] as const;

export type ActionMethodsType = typeof ActionMethods[number];

interface Action {
    name: ActionMethodsType,
    method: (ac: ActionController, ...args: any[]) => Promise<void>,
    defaultShortcut: string,
}

function mapSimpleAction(name: ActionMethodsType, method: TorrentActionMethodsType, shortcut: string): Action {
    return {
        name,
        method: async (ac: ActionController, torrentIds: number[]) => {
            await ac.client.torrentAction(method, torrentIds);
        },
        defaultShortcut: shortcut
    }
}

const Actions: Action[] = [
    mapSimpleAction("resume", "torrent-start", ""),
    mapSimpleAction("pause", "torrent-stop", ""),
    {
        name: "delete",
        method: async (ac: ActionController, torrentIds: number[], deleteLocalData: boolean) => {
            await ac.client.torrentDelete(torrentIds, deleteLocalData);
        },
        defaultShortcut: "",
    },
    mapSimpleAction("moveQueueUp", "queue-move-up", ""),
    mapSimpleAction("moveQueueDown", "queue-move-down", ""),
    {
        name: "changeDirectory",
        method: async (ac: ActionController, torrentIds: number[], location: string, move: boolean) => {
            await ac.client.torrentMove(torrentIds, location, move);
        },
        defaultShortcut: "",
    },
    {
        name: "setAltSpeedMode",
        method: async (ac: ActionController, altMode: boolean) => {
            await ac.client.setSession({ "alt-speed-enabled": altMode });
        },
        defaultShortcut: "",
    },
    {
        name: "setLabels",
        method: async (ac: ActionController, torrentIds: number[], labels: string[]) => {
            await ac.client.setTorrents(torrentIds, { labels: labels });
        },
        defaultShortcut: "",
    },
    {
        name: "setPriority",
        method: async (ac: ActionController, torrentIds: number[], priority: PriorityNumberType) => {
            await ac.client.setTorrents(torrentIds, { bandwidthPriority: priority });
        },
        defaultShortcut: "",
    },
    mapSimpleAction("verify", "torrent-verify", ""),
    mapSimpleAction("reannounce", "torrent-reannounce", ""),
];

export class ActionController {
    client: TransmissionClient;
    methodMap: Record<string, (ac: ActionController, ...args: any[]) => Promise<void>>;

    constructor(client: TransmissionClient) {
        this.client = client;
        this.methodMap = {};
        for (var action of Actions) {
            this.methodMap[action.name] = action.method;
            //TODO shortcuts
        }
    }

    async run(method: ActionMethodsType, ...args: any[]) {
        console.log("Running method", method);
        console.log("Args:", args);
        if (method in this.methodMap)
            await this.methodMap[method](this, ...args);
    }

}
