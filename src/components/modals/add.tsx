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

import { Box, Button, Checkbox, Divider, Group, Modal, ScrollArea, SegmentedControl, Text, TextInput } from "@mantine/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActionModalState, LabelsData, LocationData, TorrentLabels, TorrentLocation, useTorrentLocation } from "./common";
import { PriorityColors, PriorityNumberType, PriorityStrings } from "rpc/transmission";
import { dialog, tauri } from "@tauri-apps/api";
import { CachedFileTree, FileDirEntry } from "cachedfiletree";
import { FileTreeTable, useUnwantedFiles } from "components/tables/filetreetable";

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
                onChange={(e) => props.setStart(e.currentTarget.checked)}
                my="xl"
                styles={{
                    root: {
                        flexGrow: 1
                    }
                }} />
            <SegmentedControl
                color={PriorityColors.get(props.priority)}
                value={String(props.priority)}
                onChange={(value) => props.setPriority(+value as PriorityNumberType)}
                data={Array.from(PriorityStrings.entries()).map(([k, v]) => ({
                    value: String(k),
                    label: v,
                }))} />
        </Group>
    </>;
}

interface AddCommonModalProps extends ActionModalState {
    allLabels: string[],
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
    }), [location.path, labels, allLabels, start, priority]);

    return {
        location,
        labels,
        start,
        priority,
        props,
    }
}

export function AddMagnet(props: AddCommonModalProps) {
    const [url, setUrl] = useState<string>("");

    const common = useCommonProps(props.allLabels);

    const onAdd = useCallback(() => {
        props.actionController.addTorrent({
            url,
            downloadDir: common.location.path,
            labels: common.labels,
            paused: !common.start,
            priority: common.priority,
        });
        props.close();
    }, [props.actionController, url, common]);

    return (
        <Modal opened={props.opened} onClose={props.close} title="Add torrent by magnet link or URL" centered size="lg">
            <Divider my="sm" />
            <TextInput label="Link" w="100%" value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
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
    files: {
        name: string,
        length: number,
    }[] | null,
}

export function AddTorrent(props: AddCommonModalProps) {
    const common = useCommonProps(props.allLabels);
    const [torrentData, setTorrentData] = useState<TorrentFileData>();

    useEffect(() => {
        if (!props.opened) {
            setTorrentData(undefined);
            return;
        };

        dialog.open({
            title: "Select torrent file",
            filters: [
                {
                    name: "Torrent",
                    extensions: ["torrent"],
                }
            ]
        }).then((path) => {
            if (!path) {
                props.close();
                return undefined;
            };
            return tauri.invoke("read_file", { path: path as string });
        }).then((torrentData) => setTorrentData(torrentData as TorrentFileData)).catch((e) => {
            console.error(e);
            props.close();
        });
    }, [props.opened]);

    const fileTree = useMemo(() => {
        const ft = new CachedFileTree();
        if (torrentData) ft.parse(torrentData, true);
        return ft;
    }, [torrentData]);

    const onCheckboxChange = useUnwantedFiles(fileTree);

    const onAdd = useCallback(() => {
        props.actionController.addTorrent({
            metainfo: torrentData?.metadata,
            downloadDir: common.location.path,
            labels: common.labels,
            paused: !common.start,
            priority: common.priority,
            unwanted: fileTree.getUnwanted(),
        });
        props.close();
    }, [props.actionController, torrentData, common, fileTree]);

    return (
        torrentData === undefined ? <></> :
            <Modal opened={props.opened} onClose={props.close} title="Add torrent" centered size="lg">
                <Divider my="sm" />
                <Text>Name: {torrentData.name}</Text>
                <AddCommon {...common.props} />
                <Box w="100%" h="15rem">
                    <FileTreeTable fileTree={fileTree} brief onCheckboxChange={onCheckboxChange} />
                </Box>
                <Divider my="sm" />
                <Group position="center" spacing="md">
                    <Button onClick={onAdd} variant="filled">Add</Button>
                    <Button onClick={props.close} variant="light">Cancel</Button>
                </Group>
            </Modal>
    );
}
