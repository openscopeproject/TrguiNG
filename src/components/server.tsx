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

import React, { useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import Split from "react-split";
import { SessionInfo } from "../rpc/client";
import { Details } from "./details";
import { DefaultFilter, Filters } from "./filters";
import { TorrentTable } from "./torrenttable";
import { Torrent } from "../rpc/torrent";
import '../css/custom.css';
import { Toolbar } from "./toolbar";
import { Statusbar, StatusbarProps } from "./statusbar";
import { ActionController } from "../actions";
import { EditLabelsModal } from "./modals";
import { ClientManager } from "../clientmanager";
import { ServerConfigContext } from "../config";

interface ServerProps {
    clientManager: ClientManager,
}

function usePausingModalState(runUpdates: (run: boolean) => void): [boolean, (b: boolean) => void] {
    const [show, setShow] = useState(false);

    const setShowWrapped = useCallback((show: boolean) => {
        runUpdates(!show);
        setShow(show);
    }, [runUpdates, setShow]);

    return [show, setShowWrapped];
}

function selectedTorrentsReducer(selected: Set<number>, action: { verb: string, ids: number[] }) {
    var selected = new Set(selected);
    if (action.verb == "set") {
        selected.clear();
        for (var id of action.ids) selected.add(id);
    } else if (action.verb == "add") {
        for (var id of action.ids) selected.add(id);
    } else if (action.verb == "filter") {
        selected = new Set(Array.from(selected).filter((t) => action.ids.includes(t)));
    } else if (action.verb == "toggle") {
        if (!selected.delete(action.ids[0]))
            selected.add(action.ids[0]);
    }
    return selected;
}

export function Server(props: ServerProps) {
    const serverConfig = useContext(ServerConfigContext);
    const [torrents, setTorrents] = useState<Torrent[]>([]);
    const [session, setSession] = useState<SessionInfo>({});

    const runUpdates = useCallback((run: boolean) => {
        if (run) {
            props.clientManager.startTimers(serverConfig.name);
        } else {
            props.clientManager.stopTimers(serverConfig.name);
        }
    }, []);

    useEffect(() => {
        setTorrents(props.clientManager.servers[serverConfig.name].torrents);
        setSession(props.clientManager.servers[serverConfig.name].session);
    }, [serverConfig, props.clientManager] );

    useEffect(() => {
        props.clientManager.onTorrentsChange = setTorrents;
        props.clientManager.onSessionChange = setSession;

        return () => {
            props.clientManager.onTorrentsChange = undefined;
            props.clientManager.onSessionChange = undefined;
        }
    }, [props.clientManager]);

    const [currentTorrent, setCurrentTorrent] = useState<number>();
    const [currentFilter, setCurrentFilter] = useState({ id: "", filter: DefaultFilter });
    const [searchTerms, setSearchTerms] = useState<string[]>([]);
    const actionController = useMemo(
        () => new ActionController(props.clientManager.getClient(serverConfig.name)),
        [props.clientManager, serverConfig]);

    const searchFilter = useCallback((t: Torrent) => {
        const name = t.name.toLowerCase();
        for (var term of searchTerms)
            if (!name.includes(term)) return false;
        return true;
    }, [searchTerms]);

    const [selectedTorrents, selectedReducer] = useReducer(useCallback(
        (selected: Set<number>, action: { verb: string, ids: number[] }) =>
            selectedTorrentsReducer(selected, action), []),
        new Set<number>());

    const filteredTorrents = useMemo(
        () => {
            var filtered = torrents.filter(currentFilter.filter).filter(searchFilter);
            const ids: number[] = filtered.map((t) => t.id);
            selectedReducer({ verb: "filter", ids });
            return filtered;
        },
        [torrents, currentFilter, searchFilter]);

    const statusbarProps = useMemo<StatusbarProps>(() => {
        const selected = filteredTorrents.filter((t) => selectedTorrents.has(t.id));
        return {
            daemon_version: session.version,
            hostname: props.clientManager.getHostname(serverConfig.name),
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
    }, [serverConfig, session, filteredTorrents, selectedTorrents]);

    const [showLabelsModal, setShowLabelsModal] = usePausingModalState(runUpdates);

    const allLabels = useMemo(() => {
        var labels = new Set<string>();
        torrents.forEach((t) => t.labels.forEach((l: string) => labels.add(l)));
        return Array.from(labels).sort();
    }, [torrents]);

    const selectedLabels = useMemo(() => {
        const selected = filteredTorrents.filter((t) => selectedTorrents.has(t.id));
        var labels: string[] = [];
        selected.forEach((t) => t.labels.forEach((l: string) => {
            if (!labels.includes(l)) labels.push(l);
        }));
        return labels;
    }, [filteredTorrents, selectedTorrents]);

    const setLabels = useCallback((labels: string[]) => {
        actionController.run("setLabels", Array.from(selectedTorrents), labels).catch(console.log);
    }, [selectedTorrents, actionController]);

    return (<>
        <EditLabelsModal
            allLabels={allLabels} labels={selectedLabels}
            show={showLabelsModal} setShow={setShowLabelsModal} onSave={setLabels} />
        <div className="d-flex flex-column h-100 w-100">
            <div className="border-bottom border-dark p-2">
                <Toolbar
                    setSearchTerms={setSearchTerms}
                    actionController={actionController}
                    altSpeedMode={session["alt-speed-enabled"]}
                    setShowLabelsModal={setShowLabelsModal}
                    selectedTorrents={selectedTorrents}
                />
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
                                allLabels={allLabels}
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
                        <Details torrentId={currentTorrent} {...props} />
                    </div>
                </Split>
            </div>
            <div className="border-top border-dark py-1">
                <Statusbar {...statusbarProps} />
            </div>
        </div>
    </>);
}
