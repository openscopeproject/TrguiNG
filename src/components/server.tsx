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

import { Box, CSSObject } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import React, { useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import Split from "react-split";
import { ActionController } from "../actions";
import { ClientManager } from "../clientmanager";
import { ConfigContext, ServerConfigContext } from "../config";
import '../css/custom.css';
import { Torrent } from "../rpc/torrent";
import { MemoizedDetails } from "./details";
import { DefaultFilter, Filters } from "./filters";
import { EditLabelsModal } from "./modals/editlabels";
import { Statusbar } from "./statusbar";
import { TorrentTable, useInitialTorrentRequiredFields } from "./tables/torrenttable";
import { MemoizedToolbar } from "./toolbar";
import { RemoveModal } from "./modals/remove";
import { MoveModal } from "./modals/move";
import { AddMagnet, AddTorrent } from "./modals/add";
import { useSession, useTorrentList } from "queries";
import { TorrentFieldsType } from "rpc/transmission";

interface ServerProps {
    clientManager: ClientManager,
}

function usePausingModalState(runUpdates: (run: boolean) => void): [boolean, () => void, () => void] {
    const [opened, { open, close }] = useDisclosure(false);

    const pauseOpen = useCallback(() => {
        runUpdates(false);
        open();
    }, [runUpdates, open]);

    const closeResume = useCallback(() => {
        close();
        runUpdates(true);
    }, [runUpdates, open]);

    return [opened, pauseOpen, closeResume];
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

interface ServerModalsProps {
    actionController: ActionController,
    filteredTorrents: Torrent[],
    selectedTorrents: Set<number>,
    allLabels: string[],
    runUpdates: (run: boolean) => void
}

function ServerModals(props: ServerModalsProps) {
    const [showLabelsModal, openLabelsModal, closeLabelsModal] = usePausingModalState(props.runUpdates);
    const [showRemoveModal, openRemoveModal, closeRemoveModal] = usePausingModalState(props.runUpdates);
    const [showMoveModal, openMoveModal, closeMoveModal] = usePausingModalState(props.runUpdates);
    const [showAddMagnetModal, openAddMagnetModal, closeAddMagnetModal] = usePausingModalState(props.runUpdates);
    const [showAddTorrentModal, openAddTorrentModal, closeAddTorrentModal] = usePausingModalState(props.runUpdates);

    useEffect(() => {
        props.actionController.setModalCallbacks({
            setLabels: openLabelsModal,
            remove: openRemoveModal,
            move: openMoveModal,
            addMagnet: openAddMagnetModal,
            addTorrent: openAddTorrentModal,
        });
    }, [props.actionController, openLabelsModal, openRemoveModal, openMoveModal]);

    return <>
        <EditLabelsModal
            actionController={props.actionController}
            opened={showLabelsModal} close={closeLabelsModal}
            allLabels={props.allLabels} />
        <RemoveModal
            actionController={props.actionController}
            opened={showRemoveModal} close={closeRemoveModal} />
        <MoveModal
            actionController={props.actionController}
            opened={showMoveModal} close={closeMoveModal} />
        <AddMagnet
            actionController={props.actionController}
            opened={showAddMagnetModal} close={closeAddMagnetModal}
            allLabels={props.allLabels} />
        <AddTorrent
            actionController={props.actionController}
            opened={showAddTorrentModal} close={closeAddTorrentModal}
            allLabels={props.allLabels} />
    </>;
}

export function Server(props: ServerProps) {
    const serverConfig = useContext(ServerConfigContext);

    const client = props.clientManager.getClient(serverConfig.name);

    const actionController = useMemo(
        () => new ActionController(client),
        [props.clientManager, serverConfig.name]);

    const [currentFilter, setCurrentFilter] = useState({ id: "", filter: DefaultFilter });

    const [searchTerms, setSearchTerms] = useState<string[]>([]);
    const searchFilter = useCallback((t: Torrent) => {
        const name = t.name.toLowerCase();
        for (var term of searchTerms)
            if (!name.includes(term)) return false;
        return true;
    }, [searchTerms]);

    const [updates, runUpdates] = useState<boolean>(true);

    const [tableRequiredFields, setTableRequiredFields] = useState<TorrentFieldsType[]>(useInitialTorrentRequiredFields());

    const { data: torrents, error: torrentsError } = useTorrentList(client, updates, tableRequiredFields);
    const { data: session, error: sessionError } = useSession(client, updates);

    const [currentTorrent, setCurrentTorrentInt] = useState<number>();
    const setCurrentTorrent = useCallback(
        (id: string) => setCurrentTorrentInt(+id),
        [setCurrentTorrentInt]);

    const [selectedTorrents, selectedReducer] = useReducer(useCallback(
        (selected: Set<number>, action: { verb: string, ids: string[] }) =>
            selectedTorrentsReducer(selected, action), []),
        new Set<number>());

    useEffect(() => actionController.setSelected(selectedTorrents), [actionController, selectedTorrents]);

    const [filteredTorrents, setFilteredTorrents] = useState<Torrent[]>([]);
    useEffect(
        () => {
            var filtered = torrents?.filter(currentFilter.filter).filter(searchFilter) || [];
            const ids: string[] = filtered.map((t) => t.id);
            selectedReducer({ verb: "filter", ids });
            setFilteredTorrents(filtered);
        },
        [torrents, currentFilter, searchFilter]);

    useEffect(() => actionController.setTorrents(filteredTorrents), [actionController, filteredTorrents]);

    const allLabels = useMemo(() => {
        var labels = new Set<string>();
        torrents?.forEach((t) => t.labels.forEach((l: string) => labels.add(l)));
        return Array.from(labels).sort();
    }, [torrents]);

    return (<>
        <ServerModals {...{ actionController, filteredTorrents, selectedTorrents, runUpdates, allLabels }} />
        <div className="d-flex flex-column h-100 w-100">
            <div className="border-bottom border-dark p-2">
                <MemoizedToolbar
                    setSearchTerms={setSearchTerms}
                    actionController={actionController}
                    altSpeedMode={session?.["alt-speed-enabled"] || false}
                />
            </div>
            <SplitLayout
                left={
                    <div className="scrollable">
                        <Filters
                            torrents={torrents || []}
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
                        selectedReducer={selectedReducer}
                        onColumnVisibilityChange={setTableRequiredFields} />
                }
                bottom={
                    <div className="w-100">
                        <MemoizedDetails torrentId={currentTorrent} updates={updates} {...props} />
                    </div>
                }
            />
            <div className="border-top border-dark py-1">
                <Statusbar {...{
                    session,
                    filteredTorrents,
                    selectedTorrents,
                    hostname: props.clientManager.getHostname(serverConfig.name)
                }} />
            </div>
        </div>
    </>);
}
