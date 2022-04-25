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

import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import Split from "react-split";
import { SessionInfo, TransmissionClient } from "../rpc/client";
import { Details } from "./details";
import { DefaultFilter, Filters } from "./filters";
import { TorrentTable } from "./torrenttable";
import { Torrent } from "../rpc/torrent";
import '../css/custom.css';
import { invoke } from "@tauri-apps/api";
import { Toolbar } from "./toolbar";
import { Statusbar, StatusbarProps } from "./statusbar";

interface ServerProps {
    client: TransmissionClient,
}

export function Server(props: ServerProps) {
    const [torrents, setTorrents] = useState<Torrent[]>([]);
    const [session, setSession] = useState<SessionInfo>({});
    const [currentTorrent, setCurrentTorrent] = useState<number>();
    const [currentFilter, setCurrentFilter] = useState({ id: "", filter: DefaultFilter });
    const [selectedTorrents, selectedReducer] = useReducer(
        (selected: Set<number>, action: { verb: string, ids: number[] }) => {
            var selected = new Set(selected);
            if (action.verb == "set") {
                selected.clear();
                for(var id of action.ids) selected.add(id);
            } else if (action.verb == "add") {
                for(var id of action.ids) selected.add(id);
            } else if (action.verb == "remove") {
                for(var id of action.ids) selected.delete(id);
            } else if (action.verb == "toggle") {
                if (!selected.delete(action.ids[0]))
                    selected.add(action.ids[0]);
            }
            return selected;
        }, new Set<number>());

    useEffect(() => {
        const ids: number[] = torrents.filter((t) => !currentFilter.filter(t)).map((t) => t.id);
        selectedReducer({verb: "remove", ids});
    }, [torrents, currentFilter]);

    const filteredTorrents = useMemo(
        () => torrents.filter(currentFilter.filter), [torrents, currentFilter]);

    useEffect(() => {
        props.client.getTorrents().then(setTorrents).catch(console.log);
        props.client.getSession().then(setSession).catch(console.log);

        var timer = setInterval(() => {
            props.client.getTorrents().then(setTorrents).catch(console.log);
            props.client.getSession().then(setSession).catch(console.log);
        }, 5000);

        return () => clearInterval(timer);
    }, [props.client]);

    var readFile = useCallback((e) => {
        invoke("read_file", { path: "D:\\Downloads\\1.torrent" }).then((result) => {
            console.log("Invoke result:\n", result);
        })
    }, []);

    const statusbarProps = useMemo<StatusbarProps>(() => {
        const selected = filteredTorrents.filter((t) => selectedTorrents.has(t.id));
        return {
            daemon_version: session.version,
            hostname: props.client.hostname,
            down_rate: filteredTorrents.reduce((p, t) => p + t.rateDownload, 0),
            down_rate_limit: session["speed-limit-down-enabled"] ?
                session["alt-speed-enabled"] ? session["alt-speed-down"] : session["speed-limit-down"]
                : -1,
            up_rate: filteredTorrents.reduce((p, t) => p + t.rateUpload, 0),
            up_rate_limit: session["speed-limit-up-enabled"] ?
                session["alt-speed-enabled"] ? session["alt-speed-up"] : session["speed-limit-up"]
                : -1,
            free: session["download-dir-free-space"],
            size_total: filteredTorrents.reduce((p, t) => p + t.sizeWhenDone, 0),
            size_selected: selected.reduce((p, t) => p + t.sizeWhenDone, 0),
            size_done: selected.reduce((p, t) => p + t.haveValid, 0),
            size_left: selected.reduce((p, t) => p + t.leftUntilDone, 0),
        }
    }, [session, filteredTorrents, selectedTorrents]);

    return (
        <div className="d-flex flex-column h-100 w-100">
            <div className="border-bottom border-dark p-2">
                <Toolbar />
            </div>
            <div className="flex-grow-1">
                <Split
                    direction="vertical"
                    sizes={[70, 30]}
                    gutterSize={8}
                    snapOffset={0}
                    className="split-vertical"
                >
                    <Split
                        direction="horizontal"
                        sizes={[20, 80]}
                        gutterSize={8}
                        snapOffset={0}
                        className="split-horizontal"
                    >
                        <div className="scrollable">
                            <Filters
                                torrents={torrents}
                                currentFilter={currentFilter}
                                setCurrentFilter={setCurrentFilter} />
                        </div>
                        <TorrentTable
                            torrents={filteredTorrents}
                            setCurrentTorrent={setCurrentTorrent}
                            selectedTorrents={selectedTorrents}
                            selectedReducer={selectedReducer} />
                    </Split>
                    <div className="w-100">
                        <Details torrentId={currentTorrent} client={props.client} />
                    </div>
                </Split>
            </div>
            <div className="border-top border-dark py-1">
                <Statusbar {...statusbarProps} />
            </div>
        </div>
    );
}
