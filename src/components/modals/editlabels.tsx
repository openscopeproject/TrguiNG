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

import { Text } from "@mantine/core";
import type { ActionModalState } from "./common";
import { SaveCancelModal, TorrentLabels, TorrentsNames } from "./common";
import React, { useCallback, useEffect, useState } from "react";
import { useMutateTorrent } from "queries";
import { notifications } from "@mantine/notifications";

export function EditLabelsModal(props: ActionModalState) {
    const { opened, close } = props;
    const [labels, setLabels] = useState<string[]>([]);

    const calculateInitialLabels = useCallback(() => {
        const selected = props.serverData.current?.torrents.filter(
            (t) => props.serverData.current?.selected.has(t.id)) ?? [];
        const labels: string[] = [];
        selected.forEach((t) => t.labels?.forEach((l: string) => {
            if (!labels.includes(l)) labels.push(l);
        }));
        return labels;
    }, [props.serverData]);

    useEffect(() => {
        if (opened) setLabels(calculateInitialLabels());
    }, [calculateInitialLabels, opened]);

    const mutation = useMutateTorrent();

    const onSave = useCallback(() => {
        mutation.mutate(
            {
                torrentIds: Array.from(props.serverData.current.selected),
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
    }, [mutation, props.serverData, labels, close]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            centered
            title="Edit torrent labels"
        >
            <Text mb="md">Enter new labels for</Text>
            <TorrentsNames serverData={props.serverData} />
            <TorrentLabels allLabels={props.serverData.current.allLabels} labels={labels} setLabels={setLabels} />
        </SaveCancelModal>
    );
}
