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

import { Box, Button, Checkbox, Divider, Flex, Group, Overlay, SegmentedControl, Text, TextInput, useMantineTheme } from "@mantine/core";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ActionModalState, LabelsData, LocationData } from "./common";
import { HkModal, TorrentLabels, TorrentLocation, useTorrentLocation } from "./common";
import type { PriorityNumberType } from "rpc/transmission";
import { PriorityColors, PriorityStrings } from "rpc/transmission";
import type { Torrent } from "rpc/torrent";
import { CachedFileTree } from "cachedfiletree";
import { FileTreeTable, useUnwantedFiles } from "components/tables/filetreetable";
import { notifications } from "@mantine/notifications";
import { useAddTorrent, useFileTree } from "queries";
import { ConfigContext } from "config";
const { TAURI, dialogOpen, invoke } = await import(/* webpackChunkName: "taurishim" */"taurishim");

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
                styles={{ root: { flexGrow: 1 } }} />
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
    serverName: string,
    uri: string | File | undefined,
}

function useCommonProps(modalProps: AddCommonModalProps) {
    const location = useTorrentLocation();
    const [labels, setLabels] = useState<string[]>([]);
    const [labelData, setLabelData] = useState<LabelsData>({
        labels,
        setLabels,
        allLabels: modalProps.serverData.current.allLabels,
    });
    const [start, setStart] = useState<boolean>(true);
    const [priority, setPriority] = useState<PriorityNumberType>(0);

    useEffect(() => {
        if (modalProps.opened) {
            setLabelData({
                labels,
                setLabels,
                allLabels: modalProps.serverData.current.allLabels,
            });
        }
    }, [labels, modalProps.opened, modalProps.serverData]);

    const props = useMemo<AddCommonProps>(() => ({
        location,
        labels: labelData,
        start,
        setStart,
        priority,
        setPriority,
    }), [location, labelData, start, priority]);

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
        if (typeof props.uri === "string") setMagnet(props.uri);
    }, [props.uri]);

    const common = useCommonProps(props);
    const { close } = props;
    const mutation = useAddTorrent();

    const onAdd = useCallback(() => {
        mutation.mutate(
            {
                url: magnet,
                downloadDir: common.location.path,
                labels: common.labels,
                paused: !common.start,
                priority: common.priority,
            },
            {
                onError: (e) => {
                    console.error("Failed to add torrent:", e);
                    notifications.show({
                        title: "Error adding torrent",
                        message: String(e),
                        color: "red",
                    });
                },
            },
        );
        common.location.addPath(common.location.path);
        close();
    }, [mutation, magnet, common.location, common.labels, common.start, common.priority, close]);

    return (
        <HkModal opened={props.opened} onClose={close} title="Add torrent by magnet link or URL" centered size="lg">
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
        </HkModal>
    );
}

async function readLocalTorrent(file: File): Promise<string> {
    return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const b64 = (reader.result as string).match(/data:[^/]*\/[^;]*;base64,(.*)/)?.[1];
            if (b64 === undefined) {
                throw Error("Error reading file");
            }
            resolve(b64);
        };
        reader.readAsDataURL(file);
    });
}

function useFilesInput(
    filesInputRef: React.RefObject<HTMLInputElement>,
    close: () => void,
    setTorrentData: React.Dispatch<TorrentFileData | undefined>,
) {
    useEffect(() => {
        const input = filesInputRef.current;
        const fileInputListener = (e: Event) => {
            const element = e.target as HTMLInputElement;
            if (element.files == null) {
                close();
            } else {
                const [file] = element.files;
                readLocalTorrent(file).then((b64) => {
                    setTorrentData({
                        torrentPath: "",
                        metadata: b64,
                        name: file.name,
                        hash: "",
                        files: null,
                    });
                }).catch(() => {
                    notifications.show({
                        title: "Error reading file",
                        message: file.name,
                        color: "red",
                    });
                    close();
                });
            }
        };

        if (!TAURI) {
            input?.addEventListener("change", fileInputListener);
        }
        return () => {
            if (!TAURI) input?.removeEventListener("change", fileInputListener);
        };
    }, [close, filesInputRef, setTorrentData]);
}

interface TorrentFileData {
    torrentPath: string,
    metadata: string,
    name: string,
    hash: string,
    files: Array<{
        name: string,
        length: number,
    }> | null,
}

export function AddTorrent(props: AddCommonModalProps) {
    const config = useContext(ConfigContext);
    const common = useCommonProps(props);
    const [torrentData, setTorrentData] = useState<TorrentFileData>();

    const filesInputRef = useRef<HTMLInputElement>(null);

    const { close } = props;

    useFilesInput(filesInputRef, close, setTorrentData);

    const [existingTorrent, setExistingTorrent] = useState<Torrent>();

    useEffect(() => {
        if (torrentData !== undefined) {
            const torrent = props.serverData.current?.torrents.find((t) => t.hashString === torrentData?.hash);
            setExistingTorrent(torrent);
        }
    }, [props.serverData, props.serverName, torrentData]);

    useEffect(() => {
        if (!TAURI && props.opened) {
            if (props.uri === undefined) {
                filesInputRef.current?.click();
                close();
            } else {
                const file = props.uri as File;
                readLocalTorrent(file).then((b64) => {
                    setTorrentData({
                        torrentPath: "",
                        metadata: b64,
                        name: file.name,
                        hash: "",
                        files: null,
                    });
                }).catch(() => {
                    notifications.show({
                        title: "Error reading file",
                        message: file.name,
                        color: "red",
                    });
                    close();
                });
            }
        }
    }, [props.opened, props.uri, close]);

    useEffect(() => {
        if (TAURI && props.opened) {
            const readFile = async (path: string | null) => {
                if (path === null) {
                    props.close();
                    return undefined;
                }
                return await invoke("read_file", { path });
            };

            const pathPromise = typeof props.uri === "string"
                ? Promise.resolve(props.uri)
                : dialogOpen({
                    title: "Select torrent file",
                    filters: [{
                        name: "Torrent",
                        extensions: ["torrent"],
                    }],
                }) as Promise<string | null>;

            pathPromise.then(readFile)
                .then((torrentData) => { setTorrentData(torrentData as TorrentFileData); })
                .catch((e) => {
                    notifications.show({
                        title: "Error reading torrent",
                        message: String(e),
                        color: "red",
                    });
                    props.close();
                });
        }
    }, [props]);

    const fileTree = useMemo(() => new CachedFileTree(torrentData?.hash ?? "", -1), [torrentData]);

    const { data, refetch } = useFileTree("filetreebrief", fileTree);
    useEffect(() => {
        if (torrentData?.files != null) {
            fileTree.parse(torrentData, true);
            void refetch();
        }
    }, [torrentData, fileTree, refetch]);

    const onCheckboxChange = useUnwantedFiles(fileTree, false);

    const addMutation = useAddTorrent();

    const onAdd = useCallback(() => {
        const path = torrentData?.torrentPath;

        addMutation.mutate(
            {
                metainfo: torrentData?.metadata,
                downloadDir: common.location.path,
                labels: common.labels,
                paused: !common.start,
                priority: common.priority,
                unwanted: torrentData?.files == null ? [] : fileTree.getUnwanted(),
            },
            {
                onSuccess: (response: any) => {
                    const duplicate = response.arguments["torrent-duplicate"];
                    if (duplicate !== undefined) {
                        notifications.show({
                            title: "Torrent already exists",
                            message: duplicate.name,
                            color: "green",
                        });
                    }
                    const added = response.arguments["torrent-added"];
                    if (added !== undefined) {
                        notifications.show({
                            title: "Torrent added",
                            message: added.name,
                            color: "green",
                        });
                    }
                    if (TAURI && config.values.app.deleteAdded && path !== undefined) {
                        void invoke("remove_file", { path });
                    }
                },
                onError: (e) => {
                    console.error("Failed to add torrent:", e);
                    notifications.show({
                        title: "Error adding torrent",
                        message: String(e),
                        color: "red",
                    });
                },
            },
        );

        common.location.addPath(common.location.path);
        setTorrentData(undefined);
        close();
    }, [addMutation, close, torrentData, common, fileTree, config]);

    const modalClose = useCallback(() => {
        setTorrentData(undefined);
        close();
    }, [close]);

    const torrentExists = existingTorrent !== undefined;

    const theme = useMantineTheme();

    return (<>
        {!TAURI && <input ref={filesInputRef} type="file" accept=".torrent"
            style={{ position: "absolute", top: "-20rem", zIndex: -1 }} />}
        {torrentData === undefined
            ? <></>
            : <HkModal opened={torrentData !== undefined} onClose={modalClose} title="Add torrent" centered size="lg">
                <Divider my="sm" />
                <Text>Name: {torrentData.name}</Text>
                <div style={{ position: "relative" }}>
                    {torrentExists &&
                        <Overlay
                            opacity={0.6} blur={3}
                            color={theme.colorScheme === "dark" ? theme.colors.dark[6] : theme.white}>
                            <Flex align="center" justify="center" h="100%">
                                <Text color="red" fw="bold" fz="lg">Torrent already exists</Text>
                            </Flex>
                        </Overlay>}
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
                </div>
                <Divider my="sm" />
                <Group position="center" spacing="md">
                    <Button onClick={onAdd} variant="filled" disabled={torrentExists}>Add</Button>
                    <Button onClick={modalClose} variant="light">Cancel</Button>
                </Group>
            </HkModal>}
    </>);
}
