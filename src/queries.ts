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

import { QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import type { CachedFileTree } from "cachedfiletree";
import { ConfigContext, ServerConfigContext } from "config";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SessionInfo, TorrentActionMethodsType, TorrentAddParams } from "rpc/client";
import { useTransmissionClient } from "rpc/client";
import type { Torrent, TorrentBase } from "rpc/torrent";
import { processTorrent } from "rpc/torrent";
import type { TorrentMutableFieldsType, TorrentFieldsType, TorrentAllFieldsType } from "rpc/transmission";
const { TAURI, appWindow } = await import(/* webpackChunkName: "taurishim" */"taurishim");

export const queryClient = new QueryClient();

const TorrentKeys = {
    all: (server: string) => [server, "torrent"] as const,
    listAll: (server: string, fields: TorrentFieldsType[]) =>
        [...TorrentKeys.all(server), "list", { fields }] as const,
    details: (server: string, torrentId: number) =>
        [...TorrentKeys.all(server), { torrentId }] as const,
};

const SessionKeys = {
    all: (server: string) => [server, "session"] as const,
    full: (server: string) => [...SessionKeys.all(server), "full"] as const,
};

const SessionStatsKeys = {
    all: (server: string) => [server, "sessionStats"] as const,
};

const BandwidthGroupKeys = {
    all: (server: string) => [server, "bandwidth-group"] as const,
};

export function useTorrentList(enabled: boolean, fields: TorrentFieldsType[]) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    const [minimized, setMinimized] = useState(false);

    useEffect(() => {
        if (TAURI) {
            const unlisten1 = appWindow.listen("window-hidden", () => { setMinimized(true); });
            const unlisten2 = appWindow.listen("window-shown", () => { setMinimized(false); });

            return () => {
                unlisten1.then((unlisten) => { unlisten(); }).catch(() => { });
                unlisten2.then((unlisten) => { unlisten(); }).catch(() => { });
            };
        } else {
            const listener = () => { setMinimized(document.visibilityState === "hidden"); };

            document.addEventListener("visibilitychange", listener);

            return () => { document.removeEventListener("visibilitychange", listener); };
        }
    }, []);

    const refetchInterval = 1000 * (minimized
        ? serverConfig.intervals.torrentsMinimized
        : serverConfig.intervals.torrents);

    return useQuery({
        queryKey: TorrentKeys.listAll(serverConfig.name, fields),
        refetchInterval,
        refetchIntervalInBackground: true,
        staleTime: 1000,
        enabled,
        queryFn: useCallback(async () => {
            const torrents = await client.getTorrents(fields);
            return await Promise.all(torrents.map(
                async (t: TorrentBase) => await processTorrent(t, false, client)));
        }, [client, fields]),
    });
}

export function useTorrentDetails(torrentId: number, enabled: boolean, lookupIps: boolean, disableRefetch?: boolean) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useQuery({
        queryKey: TorrentKeys.details(serverConfig.name, torrentId),
        refetchInterval: disableRefetch === true ? false : 1000 * serverConfig.intervals.details,
        staleTime: 1000 * 5,
        enabled,
        queryFn: useCallback(async () => {
            return await processTorrent(await client.getTorrentDetails(torrentId), TAURI && lookupIps, client);
        }, [client, torrentId, lookupIps]),
    });
}

export interface TorrentMutationVariables {
    torrentIds: number[],
    fields: Partial<Record<TorrentMutableFieldsType, any>>,
}

function updateCachedTorrentFields(
    serverName: string,
    torrentIds: number[],
    fields: Partial<Record<TorrentMutableFieldsType | TorrentAllFieldsType, any>>,
) {
    queryClient.setQueriesData(
        {
            predicate: (query) => {
                const key = query.queryKey;
                return key.length === 4 &&
                    key[0] === serverName &&
                    key[1] === "torrent" &&
                    key[2] === "list";
            },
        },
        (data: Torrent[] | undefined) => {
            if (data === undefined) return undefined;
            return data.map((t) => {
                if (!torrentIds.includes(t.id)) return t;
                return { ...t, ...fields };
            });
        },
    );
    queryClient.setQueriesData(
        {
            type: "active",
            predicate: (query) => {
                const key = query.queryKey;
                return key.length === 3 &&
                    key[0] === serverName &&
                    key[1] === "torrent" &&
                    torrentIds.includes((key[2] as { torrentId: number }).torrentId);
            },
        },
        (t: Torrent | undefined) => t === undefined ? undefined : { ...t, ...fields },
    );
}

export function useMutateTorrent() {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useMutation({
        mutationFn: async ({ torrentIds, fields }: TorrentMutationVariables) => {
            await client.setTorrents(torrentIds, fields);
        },
        onSuccess: (_, { torrentIds, fields }: TorrentMutationVariables) => {
            // some mutable fields like "files-unwanted" don't map directly to
            // proper torrent fields but it's ok to have some extra entrie in the object
            updateCachedTorrentFields(serverConfig.name, torrentIds, fields);
            void queryClient.invalidateQueries(TorrentKeys.all(serverConfig.name));
        },
    });
}

export interface TorrentPathMutationVariables {
    torrentId: number,
    path: string,
    name: string,
}

export function useMutateTorrentPath() {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useMutation({
        mutationFn: async ({ torrentId, path, name }: TorrentPathMutationVariables) => {
            await client.torrentRenamePath(torrentId, path, name);
        },
        onSuccess: (_, { torrentId, path, name }: TorrentPathMutationVariables) => {
            if (path.includes("/")) {
                void queryClient.invalidateQueries(TorrentKeys.details(serverConfig.name, torrentId));
            } else {
                updateCachedTorrentFields(serverConfig.name, [torrentId], { name });
                void queryClient.invalidateQueries(TorrentKeys.all(serverConfig.name));
            }
        },
    });
}

function useInvalidatingTorrentAction<ActionParams>(mutationFn: (params: ActionParams) => Promise<void>) {
    const serverConfig = useContext(ServerConfigContext);

    return useMutation({
        mutationFn,
        onSuccess: () => {
            void queryClient.invalidateQueries(TorrentKeys.all(serverConfig.name));
        },
    }).mutate;
}

export interface TorrentAddQueryParams extends TorrentAddParams {
    filePath?: string,
}

export function useAddTorrent(onSuccess: (response: any, vars: TorrentAddQueryParams) => void, onError: (e: Error) => void) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useMutation({
        mutationFn: async (params: TorrentAddQueryParams) => {
            return await client.torrentAdd(params);
        },
        onSuccess: (response: any, vars: TorrentAddQueryParams) => {
            onSuccess(response, vars);
            void queryClient.invalidateQueries(TorrentKeys.all(serverConfig.name));
        },
        onError,
    });
}

export function useRemoveTorrents() {
    const client = useTransmissionClient();

    return useInvalidatingTorrentAction(
        async ({ torrentIds, deleteData }: { torrentIds: number[], deleteData: boolean }) => {
            await client.torrentRemove(torrentIds, deleteData);
        });
}

export function useTorrentAction() {
    const client = useTransmissionClient();

    return useInvalidatingTorrentAction(
        async ({ method, torrentIds }: { method: TorrentActionMethodsType, torrentIds: number[] }) => {
            await client.torrentAction(method, torrentIds);
        });
}

export function useTorrentChangeDirectory() {
    const client = useTransmissionClient();

    return useInvalidatingTorrentAction(
        async ({ torrentIds, location, move }: { torrentIds: number[], location: string, move: boolean }) => {
            await client.torrentMove(torrentIds, location, move);
        });
}

export function useTorrentAddTrackers() {
    const client = useTransmissionClient();

    return useInvalidatingTorrentAction(
        async ({ torrentId, trackers }: { torrentId: number, trackers: string[] }) => {
            await client.addTrackers(torrentId, trackers);
        });
}

export function useSession(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useQuery({
        queryKey: SessionKeys.all(serverConfig.name),
        refetchInterval: 1000 * serverConfig.intervals.session,
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return await client.getSession();
        }, [client]),
    });
}

export function useSessionFull(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useQuery({
        queryKey: SessionKeys.full(serverConfig.name),
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return await client.getSessionFull();
        }, [client]),
    });
}

export function useMutateSession() {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useMutation({
        mutationFn: async (session: SessionInfo) => {
            await client.setSession(session);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries(SessionKeys.all(serverConfig.name));
        },
    });
}

export function useSessionStats(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useQuery({
        queryKey: SessionStatsKeys.all(serverConfig.name),
        refetchInterval: 1000 * serverConfig.intervals.session,
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return await client.getSessionStats();
        }, [client]),
    });
}

export function useTestPort(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useQuery({
        queryKey: [serverConfig.name, "test-port"],
        staleTime: 1,
        enabled,
        queryFn: useCallback(async () => {
            return await client.testPort();
        }, [client]),
    });
}

export function useUpdateBlocklist() {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useMutation<number, Error>({
        mutationFn: async () => {
            return await client.updateBlocklist();
        },
        onSuccess: () => {
            void queryClient.refetchQueries(SessionKeys.full(serverConfig.name));
        },
    });
}

export function useBandwidthGroups(enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useQuery({
        queryKey: BandwidthGroupKeys.all(serverConfig.name),
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return await client.getBandwidthGroups();
        }, [client]),
    });
}

export function useFileTree(name: string, fileTree: CachedFileTree) {
    const config = useContext(ConfigContext);

    const initialData = useMemo(
        () => fileTree.getView(config.values.interface.flatFileTree),
        [fileTree, config]);

    return useQuery({
        queryKey: [name],
        initialData,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        queryFn: () => fileTree.getView(config.values.interface.flatFileTree),
    });
}

export function refreshFileTree(name: string) {
    void queryClient.refetchQueries({ queryKey: [name] });
}

export function useIpLookup(ip: string) {
    const client = useTransmissionClient();

    return useQuery({
        queryKey: ["ips", ip],
        staleTime: Infinity,
        cacheTime: 10 * 60 * 1000,
        queryFn: async () => {
            return await client.ipsBatcher.fetch(ip);
        },
    });
}
