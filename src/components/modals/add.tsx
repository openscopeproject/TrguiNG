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

import { Box, Button, Checkbox, Divider, Group, Modal, SegmentedControl, Text, TextInput } from "@mantine/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { type ActionModalState, type LabelsData, type LocationData, TorrentLabels, TorrentLocation, useTorrentLocation } from "./common";
import { PriorityColors, type PriorityNumberType, PriorityStrings } from "rpc/transmission";
import { dialog, tauri } from "@tauri-apps/api";
import { CachedFileTree } from "cachedfiletree";
import { FileTreeTable, useUnwantedFiles } from "components/tables/filetreetable";
import { notifications } from "@mantine/notifications";
import { useFileTree } from "queries";

interface AddCommonProps {
    location: LocationData,
    labels: LabelsData,
    start: boolean,
    setStart: (b: boolean) => void,
    priority: PriorityNumberType,
    setPriority: (p: PriorityNumberType) => void,
}

function AddCommon(props: AddCommonProps) {
    return <>
        <TorrentLocation {...props.location} inputLabel="Download directory" />
        <TorrentLabels {...props.labels} inputLabel="Labels" />
        <Group>
            <Checkbox
                label="Start torrent"
                checked={props.start}
                onChange={(e) => { props.setStart(e.currentTarget.checked); }}
                my="xl"
                styles={{
                    root: {
                        flexGrow: 1
                    }
                }} />
            <SegmentedControl
                color={PriorityColors.get(props.priority)}
                value={String(props.priority)}
                onChange={(value) => { props.setPriority(+value as PriorityNumberType); }}
                data={Array.from(PriorityStrings.entries()).map(([k, v]) => ({
                    value: String(k),
                    label: v,
                }))} />
        </Group>
    </>;
}

interface AddCommonModalProps extends ActionModalState {
    allLabels: string[],
    uri: string | undefined,
}

function useCommonProps(allLabels: string[]) {
    const location = useTorrentLocation();
    const [labels, setLabels] = useState<string[]>([]);
    const [start, setStart] = useState<boolean>(true);
    const [priority, setPriority] = useState<PriorityNumberType>(0);

    const props = useMemo<AddCommonProps>(() => ({
        location,
        labels: {
            labels,
            setLabels,
            allLabels,
        },
        start,
        setStart,
        priority,
        setPriority,
    }), [location, labels, allLabels, start, priority]);

    return {
        location,
        labels,
        start,
        priority,
        props,
    };
}

export function AddMagnet(props: AddCommonModalProps) {
    const [magnet, setMagnet] = useState<string>("");

    useEffect(() => {
        if (props.uri !== undefined) setMagnet(props.uri);
    }, [props.uri]);

    const common = useCommonProps(props.allLabels);
    const { actionController: ac, close } = props;

    const onAdd = useCallback(() => {
        // TODO handle errors
        void ac.addTorrent({
            url: magnet,
            downloadDir: common.location.path,
            labels: common.labels,
            paused: !common.start,
            priority: common.priority,
        });
        close();
    }, [ac, magnet, common.location.path, common.labels, common.start, common.priority, close]);

    return (
        <Modal opened={props.opened} onClose={close} title="Add torrent by magnet link or URL" centered size="lg">
            <Divider my="sm" />
            <TextInput
                label="Link" w="100%"
                value={magnet}
                onChange={(e) => { setMagnet(e.currentTarget.value); }} />
            <AddCommon {...common.props} />
            <Divider my="sm" />
            <Group position="center" spacing="md">
                <Button onClick={onAdd} variant="filled">Add</Button>
                <Button onClick={props.close} variant="light">Cancel</Button>
            </Group>
        </Modal>
    );
}

interface TorrentFileData {
    metadata: string,
    name: string,
    length: number,
    hash: string,
    files: Array<{
        name: string,
        length: number,
    }> | null,
}

export function AddTorrent(props: AddCommonModalProps) {
    const common = useCommonProps(props.allLabels);
    const [torrentData, setTorrentData] = useState<TorrentFileData>();

    useEffect(() => {
        if (!props.opened) {
            setTorrentData(undefined);
            return;
        }

        const process = async (path: string | null) => {
            if (path === null) {
                props.close();
                return undefined;
            }
            return await tauri.invoke("read_file", { path });
        };

        const pathPromise = props.uri !== undefined
            ? Promise.resolve(props.uri)
            : dialog.open({
                title: "Select torrent file",
                filters: [{
                    name: "Torrent",
                    extensions: ["torrent"],
                }]
            }) as Promise<string | null>;

        pathPromise.then(process)
            .then((torrentData) => { setTorrentData(torrentData as TorrentFileData); })
            .catch((e) => {
                notifications.show({
                    title: "Error reading torrent",
                    message: String(e),
                    color: "red",
                });
                props.close();
            });
    }, [props]);

    const fileTree = useMemo(() => new CachedFileTree(torrentData?.hash ?? ""), [torrentData]);

    const { data, refetch } = useFileTree("filetreebrief", fileTree);
    useEffect(() => {
        if (torrentData?.files != null) {
            fileTree.parse(torrentData, true);
            void refetch();
        }
    }, [torrentData, fileTree, refetch]);

    const onCheckboxChange = useUnwantedFiles(fileTree, false);

    const { actionController: ac, close } = props;

    const onAdd = useCallback(() => {
        // TODO handle errors
        void ac.addTorrent({
            metainfo: torrentData?.metadata,
            downloadDir: common.location.path,
            labels: common.labels,
            paused: !common.start,
            priority: common.priority,
            unwanted: torrentData?.files == null ? [] : fileTree.getUnwanted(),
        });
        close();
    }, [ac, close, torrentData, common, fileTree]);

    return (
        torrentData === undefined
            ? <></>
            : <Modal opened={props.opened} onClose={props.close} title="Add torrent" centered size="lg">
                <Divider my="sm" />
                <Text>Name: {torrentData.name}</Text>
                <AddCommon {...common.props} />
                {torrentData.files == null
                    ? <></>
                    : <Box w="100%" h="15rem">
                        <FileTreeTable
                            fileTree={fileTree}
                            data={data}
                            brief
                            onCheckboxChange={onCheckboxChange} />
                    </Box>
                }
                <Divider my="sm" />
                <Group position="center" spacing="md">
                    <Button onClick={onAdd} variant="filled">Add</Button>
                    <Button onClick={props.close} variant="light">Cancel</Button>
                </Group>
            </Modal>
    );
}
