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

import React, { useCallback, useContext, useEffect } from "react";
import type { ModalState } from "./common";
import { SaveCancelModal } from "./common";
import { useForm } from "@mantine/form";
import { useMutateTorrent, useTorrentDetails } from "queries";
import { notifications } from "@mantine/notifications";
import { Button, Checkbox, Grid, LoadingOverlay, NumberInput, Text, Textarea } from "@mantine/core";
import { ConfigContext } from "config";
import { useServerTorrentData } from "rpc/torrent";

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

export function EditTorrent(props: ModalState) {
    const config = useContext(ConfigContext);
    const serverData = useServerTorrentData();
    const torrentId = serverData.current;

    const { data: torrent, isLoading } = useTorrentDetails(
        torrentId ?? -1, torrentId !== undefined && props.opened, false, true);

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

    const addDefaultTrackers = useCallback(() => {
        let list = form.values.trackerList;
        if (!list.endsWith("\n")) list += "\n";
        list += config.values.interface.defaultTrackers.join("\n");
        form.setFieldValue("trackerList", list);
    }, [config, form]);

    return <>{props.opened &&
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            centered
            title="Edit torrent properties"
            mih="25rem"
        >
            <LoadingOverlay visible={isLoading} />
            <Grid align="center">
                <Grid.Col>
                    Torrent: {torrent?.name}
                </Grid.Col>
                <Grid.Col span={8}>
                    <Checkbox my="sm"
                        label="Honor session upload limit"
                        {...form.getInputProps("honorsSessionLimits", { type: "checkbox" })} />
                </Grid.Col>
                <Grid.Col span={4}>
                    <Checkbox my="sm"
                        label="Sequential download"
                        {...form.getInputProps("sequentialDownload", { type: "checkbox" })} />
                </Grid.Col>
                <Grid.Col span={8}>
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
                <Grid.Col span={8}>
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
                <Grid.Col span={2}>
                    KB/s
                </Grid.Col>
                <Grid.Col span={8}>
                    Peer limit
                </Grid.Col>
                <Grid.Col span={2}>
                    <NumberInput
                        min={0}
                        {...form.getInputProps("peerLimit")} />
                </Grid.Col>
                <Grid.Col span={2} />
                <Grid.Col span={8}>
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
                <Grid.Col span={2} />
                <Grid.Col span={8}>
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
                <Grid.Col span={2}>
                    minutes
                </Grid.Col>
                <Grid.Col span={8}>
                    <Text>Tracker list, one per line, empty line between tiers</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                    <Button onClick={addDefaultTrackers}>Add default list</Button>
                </Grid.Col>
                <Grid.Col>
                    <Textarea minRows={6}
                        {...form.getInputProps("trackerList")} />
                </Grid.Col>
            </Grid>
        </SaveCancelModal>}
    </>;
}
