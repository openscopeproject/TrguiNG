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
import type { ActionModalState} from "./common";
import { SaveCancelModal, TorrentLabels, TorrentsNames } from "./common";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useMutateTorrent } from "queries";
import { notifications } from "@mantine/notifications";

interface EditLabelsProps extends ActionModalState {
    allLabels: string[],
}

export function EditLabelsModal(props: EditLabelsProps) {
    const [labels, setLabels] = useState<string[]>([]);

    const initialLabels = useMemo(() => {
        const selected = props.actionController.torrents.filter(
            (t) => props.actionController.selectedTorrents.has(t.id));
        const labels: string[] = [];
        selected.forEach((t) => t.labels.forEach((l: string) => {
            if (!labels.includes(l)) labels.push(l);
        }));
        return labels;
    }, [props.actionController.torrents, props.actionController.selectedTorrents]);

    useEffect(() => {
        setLabels(initialLabels);
    }, [initialLabels]);

    const mutation = useMutateTorrent();
    const { actionController: ac, close } = props;

    const onSave = useCallback(() => {
        mutation.mutate(
            {
                torrentIds: Array.from(ac.selectedTorrents),
                fields: { labels }
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
                }
            }
        );
        close();
    }, [mutation, ac.selectedTorrents, labels, close]);

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
            <TorrentsNames actionController={props.actionController} />
            <TorrentLabels allLabels={props.allLabels} labels={labels} setLabels={setLabels} />
        </SaveCancelModal>
    );
}
