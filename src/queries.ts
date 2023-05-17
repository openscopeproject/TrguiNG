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

import { QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import type { CachedFileTree } from "cachedfiletree";
import { ServerConfigContext } from "config";
import { useCallback, useContext, useMemo } from "react";
import type { SessionInfo } from "rpc/client";
import { useTransmissionClient } from "rpc/client";
import type { Torrent } from "rpc/torrent";
import type { TorrentMutableFieldsType, TorrentFieldsType } from "rpc/transmission";

export const queryClient = new QueryClient();

const TorrentKeys = {
    all: (server: string,) => [server, "torrent"] as const,
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
    all: (server: string,) => [server, "bandwidth-group"] as const,
};

export function useTorrentList(enabled: boolean, fields: TorrentFieldsType[]) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useQuery({
        queryKey: TorrentKeys.listAll(serverConfig.name, fields),
        refetchInterval: 1000 * serverConfig.intervals.torrents,
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return await client.getTorrents(fields);
        }, [client, fields]),
    });
}

export function useTorrentDetails(torrentId: number, enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);
    const client = useTransmissionClient();

    return useQuery({
        queryKey: TorrentKeys.details(serverConfig.name, torrentId),
        refetchInterval: 1000 * serverConfig.intervals.details,
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return await client.getTorrentDetails(torrentId);
        }, [client, torrentId]),
    });
}

export interface TorrentMutationVariables {
    torrentIds: number[],
    fields: Partial<Record<TorrentMutableFieldsType, any>>,
}

function updateCachedTorrentFields(serverName: string, torrentIds: number[], fields: Torrent) {
    queryClient.setQueriesData(
        {
            predicate: (query) => {
                const key = query.queryKey;
                return key.length === 4 &&
                    key[0] === serverName &&
                    key[1] === "torrent" &&
                    key[2] === "list";
            }
        },
        (data: Torrent[] | undefined) => {
            if (data === undefined) return undefined;
            return data.map((t) => {
                if (!torrentIds.includes(t.id)) return t;
                return { ...t, ...fields };
            });
        }
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
            }
        },
        (t: Torrent | undefined) => {
            return { ...t, ...fields };
        }
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
        }
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
        }
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
        }
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
    return useQuery({
        queryKey: [name],
        initialData: useMemo(() => fileTree.flatten(), [fileTree]),
        staleTime: 0,
        queryFn: () => fileTree.flatten(),
    });
}

export function refreshFileTree(name: string) {
    void queryClient.refetchQueries({ queryKey: [name] });
}
