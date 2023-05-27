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

import "../css/custom.css";
import type { CSSObject } from "@mantine/core";
import { Box } from "@mantine/core";
import React, { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Split from "react-split";
import { ConfigContext } from "../config";
import type { Torrent } from "../rpc/torrent";
import { useServerTorrentData } from "../rpc/torrent";
import { MemoizedDetails } from "./details";
import { DefaultFilter, Filters } from "./filters";
import { Statusbar } from "./statusbar";
import { TorrentTable, useInitialTorrentRequiredFields } from "./tables/torrenttable";
import { MemoizedToolbar } from "./toolbar";
import { useSession, useTorrentList } from "queries";
import type { TorrentFieldsType } from "rpc/transmission";
import type { ModalCallbacks } from "./modals/servermodals";
import { MemoizedServerModals } from "./modals/servermodals";

function selectedTorrentsReducer(selected: Set<number>, action: { verb: string, ids: string[] }) {
    const ids = action.ids.map((t) => +t);
    if (action.verb === "set") {
        selected.clear();
        for (const id of ids) selected.add(id);
    } else if (action.verb === "add") {
        for (const id of ids) selected.add(id);
    } else if (action.verb === "filter") {
        selected = new Set(Array.from(selected).filter((t) => ids.includes(t)));
    } else if (action.verb === "toggle") {
        if (!selected.delete(ids[0])) selected.add(ids[0]);
    }
    return new Set(selected);
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
                backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[7] : theme.colors.gray[3],
            },
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

export function Server({ hostname }: { hostname: string }) {
    const [currentFilter, setCurrentFilter] = useState({ id: "", filter: DefaultFilter });

    const [searchTerms, setSearchTerms] = useState<string[]>([]);
    const searchFilter = useCallback((t: Torrent) => {
        const name = t.name.toLowerCase() as string;
        for (const term of searchTerms) {
            if (!name.includes(term)) return false;
        }
        return true;
    }, [searchTerms]);

    const [updates, runUpdates] = useState<boolean>(true);

    const [tableRequiredFields, setTableRequiredFields] = useState<TorrentFieldsType[]>(useInitialTorrentRequiredFields());

    const { data: torrents } = useTorrentList(updates, tableRequiredFields);
    const { data: session } = useSession(updates);

    const [currentTorrent, setCurrentTorrentInt] = useState<number>();
    const setCurrentTorrent = useCallback(
        (id: string) => { setCurrentTorrentInt(+id); },
        [setCurrentTorrentInt]);

    const [selectedTorrents, selectedReducer] = useReducer(
        useCallback((selected: Set<number>, action: { verb: string, ids: string[] }) =>
            selectedTorrentsReducer(selected, action), []),
        new Set<number>());

    const allLabels = useMemo(() => {
        const labels = new Set<string>();
        torrents?.forEach((t) => t.labels.forEach((l: string) => labels.add(l)));
        return Array.from(labels).sort();
    }, [torrents]);

    const serverData = useServerTorrentData(torrents ?? [], selectedTorrents, currentTorrent, allLabels);

    const [filteredTorrents, setFilteredTorrents] = useState<Torrent[]>([]);
    useEffect(
        () => {
            if ((torrents?.findIndex((t) => t.id === currentTorrent) ?? -1) === -1) setCurrentTorrentInt(undefined);
            const filtered = torrents?.filter(currentFilter.filter).filter(searchFilter) ?? [];
            const ids: string[] = filtered.map((t) => t.id);
            selectedReducer({ verb: "filter", ids });
            setFilteredTorrents(filtered);
        },
        [torrents, currentFilter, searchFilter, currentTorrent]);

    const [scrollToRow, setScrollToRow] = useState<{ id: string }>();

    useEffect(() => {
        if (currentTorrent !== undefined) setScrollToRow({ id: `${currentTorrent}` });
    }, [currentFilter, currentTorrent]);

    const modals = useRef<ModalCallbacks>(null);

    return (<>
        <MemoizedServerModals ref={modals} {...{ serverData, runUpdates }} />
        <div className="d-flex flex-column h-100 w-100">
            <div className="border-bottom border-dark p-2">
                <MemoizedToolbar
                    setSearchTerms={setSearchTerms}
                    modals={modals}
                    serverData={serverData}
                    altSpeedMode={session?.["alt-speed-enabled"] ?? false}
                />
            </div>
            <SplitLayout
                left={
                    <div className="scrollable">
                        <Filters
                            torrents={torrents ?? []}
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
                        onColumnVisibilityChange={setTableRequiredFields}
                        scrollToRow={scrollToRow} />
                }
                bottom={
                    <div className="w-100">
                        <MemoizedDetails torrentId={currentTorrent} updates={updates} />
                    </div>
                }
            />
            <div className="border-top border-dark py-1">
                <Statusbar {...{
                    session,
                    filteredTorrents,
                    selectedTorrents,
                    hostname,
                }} />
            </div>
        </div>
    </>);
}
