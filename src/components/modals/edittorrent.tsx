/**
 * TransguiNG - next gen remote GUI for transmission torrent daemon
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

import React, { useCallback, useEffect } from "react";
import type { ActionModalState } from "./common";
import { SaveCancelModal } from "./common";
import { useForm } from "@mantine/form";
import { useMutateTorrent, useTorrentDetails } from "queries";
import { notifications } from "@mantine/notifications";
import { Checkbox, Grid, NumberInput, Textarea } from "@mantine/core";

interface FormValues {
    downloadLimited?: boolean,
    downloadLimit: number,
    uploadLimited?: boolean,
    uploadLimit: number,
    peerLimit: number,
    seedRatioMode: number,
    seedRatioLimit: number,
    seedIdleMode: number,
    seedIdleLimit: number,
    trackerList: string,
    honorsSessionLimits: boolean,
    sequentialDownload: boolean,
}

export function EditTorrent(props: ActionModalState) {
    const torrentId = props.serverData.current.current;
    const { data: torrent } = useTorrentDetails(
        torrentId ?? -1, torrentId !== undefined && props.opened, true);

    const form = useForm<FormValues>({});

    const { setValues } = form;
    useEffect(() => {
        if (torrent === undefined) return;
        setValues({
            downloadLimited: torrent.downloadLimited,
            downloadLimit: torrent.downloadLimit,
            uploadLimited: torrent.uploadLimited,
            uploadLimit: torrent.uploadLimit,
            peerLimit: torrent["peer-limit"],
            seedRatioMode: torrent.seedRatioMode,
            seedRatioLimit: torrent.seedRatioLimit,
            seedIdleMode: torrent.seedIdleMode,
            seedIdleLimit: torrent.seedIdleLimit,
            trackerList: torrent.trackerList,
            honorsSessionLimits: torrent.honorsSessionLimits,
            sequentialDownload: torrent.sequentialDownload,
        });
    }, [setValues, torrent]);

    const mutation = useMutateTorrent();

    const onSave = useCallback(() => {
        if (torrentId === undefined) return;
        mutation.mutate(
            {
                torrentIds: [torrentId],
                fields: {
                    ...form.values,
                    "peer-limit": form.values.peerLimit,
                },
            },
            {
                onError: (e) => {
                    console.error("Failed to update torrent properties", e);
                    notifications.show({
                        message: "Error updating torrent",
                        color: "red",
                    });
                },
            },
        );
        props.close();
    }, [form.values, mutation, props, torrentId]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            centered
            title="Edit torrent properties"
            mih="25rem"
        >
            <Grid align="center">
                <Grid.Col>
                    Torrent: {torrent?.name}
                </Grid.Col>
                <Grid.Col span={7}>
                    <Checkbox my="sm"
                        label="Honor seession upload limit"
                        {...form.getInputProps("honorsSessionLimits", { type: "checkbox" })} />
                </Grid.Col>
                <Grid.Col span={5}>
                    <Checkbox my="sm"
                        label="Sequential download"
                        {...form.getInputProps("sequentialDownload", { type: "checkbox" })} />
                </Grid.Col>
                <Grid.Col span={7}>
                    <Checkbox
                        label="Maximum download speed"
                        {...form.getInputProps("downloadLimited", { type: "checkbox" })} />
                </Grid.Col>
                <Grid.Col span={2}>
                    <NumberInput
                        min={0}
                        {...form.getInputProps("downloadLimit")}
                        disabled={form.values.downloadLimited !== true} />
                </Grid.Col>
                <Grid.Col span={2}>
                    KB/s
                </Grid.Col>
                <Grid.Col span={7}>
                    <Checkbox
                        label="Maximum upload speed"
                        {...form.getInputProps("uploadLimited", { type: "checkbox" })} />
                </Grid.Col>
                <Grid.Col span={2}>
                    <NumberInput
                        min={0}
                        {...form.getInputProps("uploadLimit")}
                        disabled={form.values.uploadLimited !== true} />
                </Grid.Col>
                <Grid.Col span={3}>
                    KB/s
                </Grid.Col>
                <Grid.Col span={7}>
                    Peer limit
                </Grid.Col>
                <Grid.Col span={2}>
                    <NumberInput
                        min={0}
                        {...form.getInputProps("peerLimit")} />
                </Grid.Col>
                <Grid.Col span={3} />
                <Grid.Col span={7}>
                    <Checkbox
                        label="Seed ratio"
                        checked={form.values.seedRatioMode < 2}
                        indeterminate={form.values.seedRatioMode === 0}
                        onChange={() => { form.setFieldValue("seedRatioMode", (form.values.seedRatioMode + 1) % 3); }} />
                </Grid.Col>
                <Grid.Col span={2}>
                    <NumberInput
                        min={0}
                        step={0.05}
                        precision={2}
                        {...form.getInputProps("seedRatioLimit")}
                        disabled={form.values.seedRatioMode !== 1} />
                </Grid.Col>
                <Grid.Col span={3} />
                <Grid.Col span={7}>
                    <Checkbox
                        label="Stop seeding when inactive for"
                        checked={form.values.seedIdleMode < 2}
                        indeterminate={form.values.seedIdleMode === 0}
                        onChange={() => { form.setFieldValue("seedIdleMode", (form.values.seedIdleMode + 1) % 3); }} />
                </Grid.Col>
                <Grid.Col span={2}>
                    <NumberInput
                        min={0}
                        {...form.getInputProps("seedIdleLimit")}
                        disabled={form.values.seedIdleMode !== 1} />
                </Grid.Col>
                <Grid.Col span={3}>
                    minutes
                </Grid.Col>
                <Grid.Col>
                    <Textarea minRows={6}
                        label="Tracker list, one per line, empty line between tiers"
                        {...form.getInputProps("trackerList")} />
                </Grid.Col>
            </Grid>
        </SaveCancelModal>
    );
}
