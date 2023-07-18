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

import { Text } from "@mantine/core";
import type { ModalState } from "./common";
import { SaveCancelModal, TorrentLabels, TorrentsNames } from "./common";
import React, { useCallback, useEffect, useState } from "react";
import { useMutateTorrent } from "queries";
import { notifications } from "@mantine/notifications";
import { useServerTorrentData } from "rpc/torrent";

export function EditLabelsModal(props: ModalState) {
    const { opened, close } = props;
    const serverData = useServerTorrentData();
    const [labels, setLabels] = useState<string[]>([]);

    const calculateInitialLabels = useCallback(() => {
        const selected = serverData.torrents.filter(
            (t) => serverData.selected.has(t.id)) ?? [];
        const labels: string[] = [];
        selected.forEach((t) => t.labels?.forEach((l: string) => {
            if (!labels.includes(l)) labels.push(l);
        }));
        return labels;
    }, [serverData]);

    useEffect(() => {
        if (opened) setLabels(calculateInitialLabels());
    }, [calculateInitialLabels, opened]);

    const mutation = useMutateTorrent();

    const onSave = useCallback(() => {
        if (serverData.rpcVersion < 16) {
            notifications.show({
                title: "Can not set labels",
                message: "Labels feature requires transmission 3.0 or later",
                color: "red",
            });
            close();
            return;
        }
        mutation.mutate(
            {
                torrentIds: Array.from(serverData.selected),
                fields: { labels },
            },
            {
                onSuccess: () => {
                    notifications.show({
                        message: "Labels are updated",
                        color: "green",
                    });
                },
                onError: (error) => {
                    notifications.show({
                        title: "Failed to update labels",
                        message: String(error),
                        color: "red",
                    });
                },
            },
        );
        close();
    }, [serverData.rpcVersion, serverData.selected, mutation, labels, close]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            centered
            title="Edit torrent labels"
        >
            {serverData.rpcVersion < 16
                ? <Text color="red" fz="lg">Labels feature requires transmission 3.0 or later</Text>
                : <>
                    <Text mb="md">Enter new labels for</Text>
                    <TorrentsNames />
                </>}
            <TorrentLabels labels={labels} setLabels={setLabels} disabled={serverData.rpcVersion < 16} />
        </SaveCancelModal>
    );
}
