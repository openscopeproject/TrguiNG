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
import { ServerConfigContext } from "config";
import { useCallback, useContext } from "react";
import { type SessionInfo, type TransmissionClient } from "rpc/client";
import { type Torrent } from "rpc/torrent";
import { type TorrentFieldsType } from "rpc/transmission";

export const queryClient = new QueryClient();

const TorrentKeys = {
    all: (server: string,) => [server, "torrent"] as const,
    listAll: (server: string, fields: TorrentFieldsType[]) =>
        [...TorrentKeys.all(server), "list", { fields }] as const,
    list: (server: string, torrentIds: number[], fields: TorrentFieldsType[]) =>
        [...TorrentKeys.all(server), { fields, torrentIds }] as const,
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

export function useTorrentList(client: TransmissionClient, enabled: boolean, fields: TorrentFieldsType[]) {
    const serverConfig = useContext(ServerConfigContext);

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

export function useTorrentDetails(client: TransmissionClient, torrentId: number, enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: TorrentKeys.details(serverConfig.name, torrentId),
        refetchInterval: 1000 * serverConfig.intervals.torrents,
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return await client.getTorrentDetails(torrentId);
        }, [client, torrentId]),
    });
}

export interface TorrentMutationVariables {
    torrentIds: number[],
    fields: Torrent,
}

export function useMutateTorrent(client: TransmissionClient) {
    const serverConfig = useContext(ServerConfigContext);

    return useMutation({
        mutationFn: async ({ torrentIds, fields }: TorrentMutationVariables) => {
            await client.setTorrents(torrentIds, fields);
        },
        onSuccess: (_, { torrentIds, fields }: TorrentMutationVariables) => {
            queryClient.setQueryData(
                TorrentKeys.all(serverConfig.name),
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
                            key[0] === serverConfig.name &&
                            key[1] === "torrent" &&
                            torrentIds.includes((key[2] as { torrentId: number }).torrentId);
                    }
                },
                (t: Torrent | undefined) => {
                    return { ...t, ...fields };
                }
            );
            void queryClient.invalidateQueries(TorrentKeys.all(serverConfig.name));
        }
    });
}

export function useSession(client: TransmissionClient, enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

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

export function useSessionFull(client: TransmissionClient, enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: SessionKeys.full(serverConfig.name),
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return await client.getSessionFull();
        }, [client]),
    });
}

export function useMutateSession(client: TransmissionClient) {
    const serverConfig = useContext(ServerConfigContext);

    return useMutation({
        mutationFn: async (session: SessionInfo) => {
            return await client.setSession(session);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: SessionKeys.all(serverConfig.name)
            });
        }
    });
}

export function useSessionStats(client: TransmissionClient, enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: SessionStatsKeys.all(serverConfig.name),
        refetchInterval: 1000 * serverConfig.intervals.session,
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async() => {
            return await client.getSessionStats();
        }, [client]),
    });
}

export function useTestPort(client: TransmissionClient, enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: [serverConfig.name, "test-port"],
        staleTime: 1,
        enabled,
        queryFn: useCallback(async () => {
            return await client.testPort();
        }, [client]),
    });
}

export function useBandwidthGroups(client: TransmissionClient, enabled: boolean) {
    const serverConfig = useContext(ServerConfigContext);

    return useQuery({
        queryKey: BandwidthGroupKeys.all(serverConfig.name),
        staleTime: 1000 * 60,
        enabled,
        queryFn: useCallback(async () => {
            return await client.getBandwidthGroups();
        }, [client]),
    });
}
