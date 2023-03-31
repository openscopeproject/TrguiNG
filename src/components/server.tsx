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
import { TorrentTable } from "./tables/torrenttable";
import { Torrent } from "../rpc/torrent";
import '../css/custom.css';
import { Toolbar } from "./toolbar";
import { Statusbar, StatusbarProps } from "./statusbar";
import { ActionController } from "../actions";
import { EditLabelsModal } from "./modals/editlabels";
import { ClientManager } from "../clientmanager";
import { ConfigContext, ServerConfigContext } from "../config";
import { useDisclosure } from "@mantine/hooks";
import { Box, CSSObject, useMantineColorScheme, useMantineTheme } from "@mantine/core";
import { useForceRender } from "util";

interface ServerProps {
    clientManager: ClientManager,
}

function usePausingModalState(runUpdates: (run: boolean) => void): [boolean, () => void, () => void] {
    const [opened, { open, close }] = useDisclosure(false);

    const setShowWrapped = useCallback((show: boolean) => {
        runUpdates(!show);
        if (show)
            open();
        else
            close();
    }, [runUpdates, open, close]);

    return [opened, open, close];
}

function selectedTorrentsReducer(selected: Set<number>, action: { verb: string, ids: string[] }) {
    var selected = new Set(selected);
    var ids = action.ids.map((t) => +t);
    if (action.verb == "set") {
        selected.clear();
        for (var id of ids) selected.add(id);
    } else if (action.verb == "add") {
        for (var id of ids) selected.add(id);
    } else if (action.verb == "filter") {
        selected = new Set(Array.from(selected).filter((t) => ids.includes(t)));
    } else if (action.verb == "toggle") {
        if (!selected.delete(ids[0]))
            selected.add(ids[0]);
    }
    return selected;
}

function SplitLayout({ left, right, bottom }: { left: React.ReactNode, right: React.ReactNode, bottom: React.ReactNode }) {
    const config = useContext(ConfigContext);

    const onVerticalDragEnd = useCallback((sizes: [number, number]) => {
        config.values.app.sashSizes.vertical = sizes;
    }, [config]);
    const onHorizontalDragEnd = useCallback((sizes: [number, number]) => {
        config.values.app.sashSizes.horizontal = sizes;
    }, [config]);

    return (
        <Box sx={(theme): CSSObject => ({
            flexGrow: 1,
            "& .gutter": {
                backgroundColor: theme.colorScheme == "dark" ? theme.colors.gray[7] : theme.colors.gray[3],
            }
        })
        } >
            <Split
                direction="vertical"
                sizes={config.values.app.sashSizes.vertical}
                snapOffset={0}
                gutterSize={6}
                className="split-vertical"
                onDragEnd={onVerticalDragEnd}
            >
                <Split
                    direction="horizontal"
                    sizes={config.values.app.sashSizes.horizontal}
                    snapOffset={0}
                    gutterSize={6}
                    className="split-horizontal"
                    onDragEnd={onHorizontalDragEnd}
                >
                    {left}
                    {right}
                </Split>
                {bottom}
            </Split>
        </ Box>
    );
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
    }, [serverConfig, props.clientManager]);

    useEffect(() => {
        props.clientManager.onTorrentsChange = setTorrents;
        props.clientManager.onSessionChange = setSession;

        return () => {
            props.clientManager.onTorrentsChange = undefined;
            props.clientManager.onSessionChange = undefined;
        }
    }, [props.clientManager]);

    const [currentTorrent, setCurrentTorrentInt] = useState<number>();
    const setCurrentTorrent = useCallback(
        (id: string) => setCurrentTorrentInt(+id),
        [setCurrentTorrentInt]);
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
        (selected: Set<number>, action: { verb: string, ids: string[] }) =>
            selectedTorrentsReducer(selected, action), []),
        new Set<number>());

    const filteredTorrents = useMemo(
        () => {
            var filtered = torrents.filter(currentFilter.filter).filter(searchFilter);
            const ids: string[] = filtered.map((t) => t.id);
            selectedReducer({ verb: "filter", ids });
            return filtered;
        },
        [torrents, currentFilter, searchFilter]);

    const statusbarProps = useMemo<StatusbarProps>(() => {
        const selected = filteredTorrents.filter((t) => selectedTorrents.has(t.id));
        return {
            daemon_version: session.version,
            hostname: props.clientManager.getHostname(serverConfig.name),
            downRate: filteredTorrents.reduce((p, t) => p + t.rateDownload, 0),
            downRateLimit: session["speed-limit-down-enabled"] ?
                session["alt-speed-enabled"] ? session["alt-speed-down"] : session["speed-limit-down"]
                : -1,
            upRate: filteredTorrents.reduce((p, t) => p + t.rateUpload, 0),
            upRateLimit: session["speed-limit-up-enabled"] ?
                session["alt-speed-enabled"] ? session["alt-speed-up"] : session["speed-limit-up"]
                : -1,
            free: session["download-dir-free-space"],
            sizeTotal: filteredTorrents.reduce((p, t) => p + t.sizeWhenDone, 0),
            sizeSelected: selected.reduce((p, t) => p + t.sizeWhenDone, 0),
            sizeDone: selected.reduce((p, t) => p + t.haveValid, 0),
            sizeLeft: selected.reduce((p, t) => p + t.leftUntilDone, 0),
        }
    }, [serverConfig, session, filteredTorrents, selectedTorrents]);

    const [showLabelsModal, openLabelsModal, closeLabelsModal] = usePausingModalState(runUpdates);

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
            opened={showLabelsModal} close={closeLabelsModal} onSave={setLabels} />
        <div className="d-flex flex-column h-100 w-100">
            <div className="border-bottom border-dark p-2">
                <Toolbar
                    setSearchTerms={setSearchTerms}
                    actionController={actionController}
                    altSpeedMode={session["alt-speed-enabled"]}
                    setShowLabelsModal={openLabelsModal}
                    selectedTorrents={selectedTorrents}
                />
            </div>
            <SplitLayout
                left={
                    <div className="scrollable">
                        <Filters
                            torrents={torrents}
                            allLabels={allLabels}
                            currentFilter={currentFilter}
                            setCurrentFilter={setCurrentFilter} />
                    </div>
                }
                right={
                    <TorrentTable
                        torrents={filteredTorrents}
                        setCurrentTorrent={setCurrentTorrent}
                        selectedTorrents={selectedTorrents}
                        selectedReducer={selectedReducer} />
                }
                bottom={
                    <div className="w-100">
                        <Details torrentId={currentTorrent} {...props} />
                    </div>
                }
            />
            <div className="border-top border-dark py-1">
                <Statusbar {...statusbarProps} />
            </div>
        </div>
    </>);
}
