/**
 * TrguiNG - next gen remote GUI for transmission torrent daemon
 * Copyright (C) 2023  qu1ck (mail at qu1ck.org)
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

import "../css/custom.css";
import { Box, Flex, Loader, Overlay, Title } from "@mantine/core";
import React, { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ConfigContext, ServerConfigContext } from "../config";
import type { Torrent } from "../rpc/torrent";
import { getTorrentMainTracker, useServerTorrentData } from "../rpc/torrent";
import { MemoizedDetails } from "./details";
import type { TorrentFilter } from "./filters";
import { DefaultFilter, Filters } from "./filters";
import { Statusbar } from "./statusbar";
import { TorrentTable, useInitialTorrentRequiredFields } from "./tables/torrenttable";
import { MemoizedToolbar } from "./toolbar";
import { useSession, useTorrentList } from "queries";
import type { TorrentFieldsType } from "rpc/transmission";
import type { ModalCallbacks } from "./modals/servermodals";
import { MemoizedServerModals } from "./modals/servermodals";
import { useAppHotkeys, useHotkeysContext } from "hotkeys";
import { SplitLayout } from "./splitlayout";
import { useDisclosure } from "@mantine/hooks";

function currentFiltersReducer(
    oldFilters: TorrentFilter[],
    action: { verb: "set" | "toggle", filter: TorrentFilter },
) {
    if (action.verb === "set") return [action.filter];
    const newFilters = oldFilters.filter((filter) => filter.id !== action.filter.id);
    if (newFilters.length === oldFilters.length) {
        newFilters.push(action.filter);
    }
    return newFilters;
}

function useSelected(torrents: Torrent[] | undefined) {
    const hk = useHotkeysContext();
    const selectAll = useRef(() => { });

    const [selectedTorrents, selectedReducer] = useReducer((
        selected: Set<number>,
        action: { verb: "add" | "set" | "toggle" | "filter", ids: string[] },
    ) => {
        let result = new Set(selected);
        const ids = action.ids.map((t) => +t);
        if (action.verb === "set") {
            result.clear();
            for (const id of ids) result.add(id);
        } else if (action.verb === "add") {
            for (const id of ids) result.add(id);
        } else if (action.verb === "filter") {
            result = new Set(Array.from(result).filter((t) => ids.includes(t)));
        } else if (action.verb === "toggle") {
            for (const id of ids) {
                if (!result.delete(id)) result.add(id);
            }
        }

        if (action.verb !== "filter") hk.handlers.selectAll = () => { selectAll.current?.(); };

        return result;
    }, new Set<number>());

    useEffect(() => {
        return () => { hk.handlers.selectAll = () => { }; };
    }, [hk]);

    return { selectedTorrents, selectedReducer, selectAll };
}

export function Server({ hostname }: { hostname: string }) {
    useAppHotkeys();

    const [currentFilters, setCurrentFilters] = useReducer(currentFiltersReducer, [{ id: "", filter: DefaultFilter }]);

    const [searchTerms, setSearchTerms] = useState<string[]>([]);
    const searchFilter = useCallback((t: Torrent) => {
        const name = t.name.toLowerCase() as string;
        for (const term of searchTerms) {
            if (!name.includes(term)) return false;
        }
        return true;
    }, [searchTerms]);

    const [updates, runUpdates] = useState<boolean>(true);

    const [tableRequiredFields, setTableRequiredFields] =
        useState<TorrentFieldsType[]>(useInitialTorrentRequiredFields());

    const {
        data: session,
        isLoading: sessionIsLoading,
        isError: sessionIsError,
        error: sessionError,
    } = useSession(updates);
    const { data: torrents } = useTorrentList(updates, tableRequiredFields);

    const [currentTorrent, setCurrentTorrentInt] = useState<number>();
    const setCurrentTorrent = useCallback(
        (id: string) => { setCurrentTorrentInt(+id); },
        [setCurrentTorrentInt]);

    const [allLabels, allTrackers] = useMemo(() => {
        const labels = new Set<string>();
        torrents?.forEach((t) => t.labels?.forEach((l: string) => labels.add(l)));

        const trackers = new Set<string>();
        torrents?.forEach((t) => trackers.add(getTorrentMainTracker(t)));

        return [Array.from(labels).sort(), Array.from(trackers).sort()];
    }, [torrents]);

    const { selectedTorrents, selectedReducer, selectAll } = useSelected(torrents);

    const [filteredTorrents, setFilteredTorrents] = useState<Torrent[]>([]);
    useEffect(() => {
        if ((torrents?.findIndex((t) => t.id === currentTorrent) ?? -1) === -1) setCurrentTorrentInt(undefined);

        const filtered = torrents?.filter((t) => {
            return currentFilters.find((f) => !f.filter(t)) === undefined;
        }).filter(searchFilter) ?? [];

        const ids: string[] = filtered.map((t) => t.id);

        selectedReducer({ verb: "filter", ids });
        setFilteredTorrents(filtered);
    }, [torrents, currentFilters, searchFilter, currentTorrent, selectedReducer]);

    selectAll.current = useCallback(() => {
        const ids = filteredTorrents.map((t) => t.id) ?? [];
        selectedReducer({ verb: "set", ids });
    }, [filteredTorrents, selectedReducer]);

    const [scrollToRow, setScrollToRow] = useState<{ id: string }>();

    useEffect(() => {
        if (currentTorrent !== undefined) setScrollToRow({ id: `${currentTorrent}` });
    }, [currentFilters, currentTorrent]);

    const modals = useRef<ModalCallbacks>(null);

    const overlayVisible = sessionIsError || sessionIsLoading ||
        session?.["rpc-version"] === undefined || session["rpc-version"] < 15;

    const serverData = useServerTorrentData(torrents ?? [], selectedTorrents, currentTorrent, allLabels);

    const config = useContext(ConfigContext);
    const serverConfig = useContext(ServerConfigContext);

    const [showFiltersPanel, { toggle: toggleFiltersPanel }] = useDisclosure(config.values.interface.showFiltersPanel);
    const [showDetailsPanel, { toggle: toggleDetailsPanel }] = useDisclosure(config.values.interface.showDetailsPanel);

    useEffect(() => {
        config.values.interface.showFiltersPanel = showFiltersPanel;
        config.values.interface.showDetailsPanel = showDetailsPanel;
    }, [config, showFiltersPanel, showDetailsPanel]);

    return (
        <Flex direction="column" w="100%" h="100%" sx={{ position: "relative" }}>
            <MemoizedServerModals ref={modals} {...{ serverData, runUpdates }} serverName={serverConfig.name} />
            {overlayVisible && <Overlay blur={10}>
                <Flex align="center" justify="center" h="100%" direction="column" gap="xl">
                    {sessionIsLoading
                        ? <Loader size="xl" />
                        : sessionIsError
                            ? <><Title color="red" order={1}>Failed to load session</Title>
                                <Title color="red" order={3}>{(sessionError as Error).message}</Title></>
                            : session?.["rpc-version"] === undefined
                                ? <Title color="red" order={1}>Server does not appear to be transmission daemon</Title>
                                : session["rpc-version"] < 15
                                    ? <Title color="red" order={1}>Transmission version 2.80 or higher is required.</Title>
                                    : <></>}
                </Flex>
            </Overlay>}
            <Box p="sm" sx={(theme) => ({ borderBottom: "1px solid", borderColor: theme.colors.dark[3] })}>
                <MemoizedToolbar
                    setSearchTerms={setSearchTerms}
                    modals={modals}
                    serverData={serverData}
                    altSpeedMode={session?.["alt-speed-enabled"] ?? false}
                    toggleFiltersPanel={toggleFiltersPanel}
                    toggleDetailsPanel={toggleDetailsPanel}
                />
            </Box>
            <SplitLayout key={`split-${showFiltersPanel ? "filter" : "nofilter"}-${showDetailsPanel ? "details" : "nodetails"}`}
                left={showFiltersPanel
                    ? <div className="scrollable">
                        <Filters
                            torrents={torrents ?? []}
                            allLabels={allLabels}
                            allTrackers={allTrackers}
                            currentFilters={currentFilters}
                            setCurrentFilters={setCurrentFilters} />
                    </div>
                    : undefined}
                right={
                    <TorrentTable
                        serverData={serverData}
                        modals={modals}
                        torrents={filteredTorrents}
                        setCurrentTorrent={setCurrentTorrent}
                        selectedTorrents={selectedTorrents}
                        selectedReducer={selectedReducer}
                        onColumnVisibilityChange={setTableRequiredFields}
                        scrollToRow={scrollToRow} />
                }
                bottom={showDetailsPanel
                    ? <MemoizedDetails torrentId={currentTorrent} updates={updates} />
                    : undefined}
            />
            <Box px="xs" sx={(theme) => ({ borderTop: "1px solid", borderColor: theme.colors.dark[3] })}>
                <Statusbar {...{
                    session,
                    filteredTorrents,
                    selectedTorrents,
                    hostname,
                }} />
            </Box>
        </Flex >
    );
}
