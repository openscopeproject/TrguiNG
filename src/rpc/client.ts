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

import { Buffer } from 'buffer';

import * as http from '@tauri-apps/api/http';
import { SessionAllFields, SessionFields, TorrentAllFields, TorrentFields } from './transmission';
import { ServerConnection } from '../config';
import { Torrent } from './torrent';
import { merge } from 'lodash';

class ApiError extends Error {

}

class ApiResponse {
    result: string = "";
    arguments?: any;
    tag?: number;
}

export interface SessionInfo extends Record<string, any> {

}

function isApiResponse(response: any): response is ApiResponse {
    return "result" in response && typeof response.result == "string";
}

export class TransmissionClient {
    url: string;
    hostname: string;
    auth: string;
    headers: Record<string, string>;
    timeout: number;
    client: http.Client | null;
    session_info: SessionInfo;

    constructor(connection: ServerConnection, timeout = 15) {
        this.url = connection.url;
        this.hostname = new URL(this.url).hostname;
        this.auth = "Basic " + Buffer.from(connection.username + ":" + connection.password, 'utf-8').toString('base64');
        this.headers = { "Authorization": this.auth };
        this.timeout = timeout;
        this.client = null;
        this.session_info = {};
    }

    getHeader(headers: Record<string, string>, header: string) {
        for (var h in headers) {
            if (header.toLowerCase() == h.toLowerCase())
                return headers[h];
        }
        return null;
    }

    async sendRpc(data: Object) {
        if (!this.client) {
            this.client = await http.getClient(
                { connectTimeout: this.timeout, maxRedirections: 3 });
        }

        var response = await this.client.post(
            this.url,
            { type: "Json", payload: data },
            { headers: this.headers });

        if (response.status == 409) {
            var sid = this.getHeader(response.headers, "X-Transmission-Session-Id");
            if (!sid) {
                throw new ApiError('Got 409 response without session id header');
            }
            this.headers["X-Transmission-Session-Id"] = sid;

            response = await this.client.post(
                this.url,
                { type: "Json", payload: data },
                { headers: this.headers });
        }

        if (response.ok) {
            return response.data;
        } else {
            console.log(response);
            throw new Error("Server returned error");
        }
    }

    async getTorrents(): Promise<Torrent[]> {
        var request = {
            method: "torrent-get",
            arguments: { fields: TorrentFields }
        };

        var response = await this.sendRpc(request);

        if (!isApiResponse(response)) {
            throw new ApiError('torrent-get response is not torrents');
        }

        return response.arguments.torrents;
    }

    async getTorrentDetails(id: number): Promise<Torrent> {
        var request = {
            method: "torrent-get",
            arguments: {
                fields: TorrentAllFields,
                ids: [id]
            }
        };

        var response = await this.sendRpc(request);

        if (!isApiResponse(response)) {
            throw new ApiError('torrent-get response is not torrents');
        }

        var torrent = response.arguments.torrents.find((torrent: Torrent) => torrent.id == id);

        if (!torrent) {
            throw new ApiError(`Torrent with id ${id} was not found`);
        }

        return torrent;
    }

    async _getSession(fields: Readonly<string[]>): Promise<SessionInfo> {
        var request = {
            method: "session-get",
            arguments: { fields: fields }
        };

        var response = await this.sendRpc(request);

        if (!isApiResponse(response)) {
            throw new ApiError('session-get response is not a session');
        }

        return response.arguments;
    }

    async getSession(): Promise<SessionInfo> {
        const session = await this._getSession(SessionFields);
        merge(this.session_info, session);
        return this.session_info;
    }

    async getSessionFull(): Promise<SessionInfo> {
        const session = await this._getSession(SessionAllFields);
        merge(this.session_info, session);
        return this.session_info;
    }

    async setSession(fields: Record<string, any>) {
        var request = {
            method: "session-set",
            arguments: fields,
        };

        await this.sendRpc(request);
    }

    async setTorrents(torrentIds: number[], fields: Record<string, any>) {
        console.log("setting", torrentIds, fields);
        var request = {
            method: "torrent-set",
            arguments: {...fields, ids: torrentIds},
        }

        await this.sendRpc(request);
    }
}
