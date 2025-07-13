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

import { ActionIcon, Box, Button, Checkbox, Divider, Flex, Group, Menu, SegmentedControl, Text, TextInput } from "@mantine/core";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ModalState, LocationData } from "./common";
import { HkModal, LimitedNamesList, TorrentLabels, TorrentLocation, useTorrentLocation } from "./common";
import type { PriorityNumberType } from "rpc/transmission";
import { PriorityColors, PriorityStrings } from "rpc/transmission";
import type { Torrent } from "rpc/torrent";
import { useServerTorrentData, useServerRpcVersion } from "rpc/torrent";
import { CachedFileTree } from "cachedfiletree";
import { FileTreeTable, useUnwantedFiles } from "components/tables/filetreetable";
import { notifications } from "@mantine/notifications";
import type { TorrentAddQueryParams } from "queries";
import { useAddTorrent, useFileTree, useTorrentAddTrackers } from "queries";
import { AddTorrentPriorityOptions, ConfigContext, ServerConfigContext } from "config";
import type { ServerTabsRef } from "components/servertabs";
import { bytesToHumanReadableStr, decodeMagnetLink } from "trutil";
import { useToggle } from "@mantine/hooks";
import * as Icon from "react-bootstrap-icons";

const { TAURI, dialogOpen, invoke } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface AddCommonProps extends React.PropsWithChildren {
    opened: boolean,
    location: LocationData,
    labels: string[],
    setLabels: React.Dispatch<string[]>,
    start: boolean,
    setStart: (b: boolean) => void,
    priority: PriorityNumberType,
    setPriority: (p: PriorityNumberType) => void,
    disabled?: boolean,
}

function AddCommon(props: AddCommonProps) {
    const rpcVersion = useServerRpcVersion();

    return <>
        <TorrentLocation {...props.location} inputLabel="Download directory" disabled={props.disabled} />
        {rpcVersion >= 17 &&
            <TorrentLabels labels={props.labels} setLabels={props.setLabels} inputLabel="Labels" disabled={props.disabled} />}
        <Group>
            <Checkbox
                label="Start torrent"
                checked={props.start}
                disabled={props.disabled}
                onChange={(e) => { props.setStart(e.currentTarget.checked); }}
                my="xl"
                styles={{ root: { flexGrow: 1 } }} />
            {props.children}
            <SegmentedControl
                color={PriorityColors.get(props.priority)}
                value={String(props.priority)}
                onChange={(value) => { props.setPriority(+value as PriorityNumberType); }}
                disabled={props.disabled}
                data={Array.from(PriorityStrings.entries()).map(([k, v]) => ({
                    value: String(k),
                    label: v,
                }))} />
        </Group>
    </>;
}

interface AddCommonModalProps extends ModalState {
    serverName: string,
    uri: string | File | undefined,
    tabsRef: React.RefObject<ServerTabsRef>,
}

function useCommonProps(opened: boolean) {
    const config = useContext(ConfigContext);
    const location = useTorrentLocation();
    const [labels, setLabels] = useState<string[]>([]);
    const [start, setStart] = useState<boolean>(true);
    const [priority, setPriority] = useState<PriorityNumberType>(0);

    useEffect(() => {
        if (opened) {
            if (config.values.interface.addTorrentStart === "remember selection") {
                setStart(config.values.interface.addTorrentStartSelection);
            } else {
                setStart(config.values.interface.addTorrentStart === "default on");
            }
            if (config.values.interface.addTorrentPriority === "remember selection") {
                setPriority(config.values.interface.addTorrentPrioritySelection);
            } else {
                setPriority((AddTorrentPriorityOptions.indexOf(
                    config.values.interface.addTorrentPriority) - 1) as PriorityNumberType);
            }
        }
    }, [config, opened]);

    const props = useMemo<AddCommonProps>(() => ({
        opened,
        location,
        labels,
        setLabels,
        start,
        setStart,
        priority,
        setPriority,
    }), [opened, location, labels, start, priority]);

    return useMemo(() => ({
        location,
        start,
        priority,
        props,
        onAdd: () => {
            config.values.interface.addTorrentStartSelection = start;
            config.values.interface.addTorrentPrioritySelection = priority;
        },
    }), [config, location, priority, props, start]);
}

function TabSwitchDropdown({ tabsRef }: { tabsRef: React.RefObject<ServerTabsRef> }) {
    const serverConfig = useContext(ServerConfigContext);

    const [value, setValue] = useState(serverConfig.name);

    useEffect(() => {
        setValue(serverConfig.name);
    }, [serverConfig]);

    const onChange = useCallback((value: string) => {
        setValue(value);
        const tabIndex = tabsRef.current?.getOpenTabs().findIndex((v) => v === value);
        if (tabIndex !== undefined) tabsRef.current?.switchTab(tabIndex);
    }, [tabsRef]);

    return (
        tabsRef.current == null
            ? <></>
            : <Menu shadow="md" width={200} position="bottom-start">
                <Menu.Target>
                    <Button variant="subtle" title="Switch server">
                        {value}
                    </Button>
                </Menu.Target>

                <Menu.Dropdown>
                    {tabsRef.current.getOpenTabs().map((tab) =>
                        <Menu.Item key={tab} onClick={() => { onChange(tab); }}>{tab}</Menu.Item>)
                    }
                </Menu.Dropdown>
            </Menu>
    );
}

export function AddMagnet(props: AddCommonModalProps) {
    const serverData = useServerTorrentData();
    const [magnet, setMagnet] = useState<string>("");

    useEffect(() => {
        if (props.opened) {
            if (typeof props.uri === "string") setMagnet(props.uri);
            else setMagnet("");
        }
    }, [props.uri, props.opened]);

    const [magnetData, setMagnetData] = useState<{ hash: string, trackers: string[] }>();

    useEffect(() => {
        setMagnetData(decodeMagnetLink(magnet));
    }, [magnet]);

    const [existingTorrent, setExistingTorrent] = useState<Torrent>();

    useEffect(() => {
        if (magnetData !== undefined && magnetData.hash !== "") {
            const torrent = serverData.torrents.find((t) => t.hashString === magnetData.hash);
            setExistingTorrent(torrent);
        } else {
            setExistingTorrent(undefined);
        }
    }, [serverData, props.serverName, magnetData]);

    const common = useCommonProps(props.opened);
    const { close } = props;
    const addMutation = useAddTorrent(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useCallback((response: any) => {
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
        }, []),
        useCallback((e) => {
            console.error("Failed to add torrent:", e);
            notifications.show({
                title: "Error adding torrent",
                message: String(e),
                color: "red",
            });
        }, []),
    );
    const mutateAddTrackers = useTorrentAddTrackers();

    const onAdd = useCallback(() => {
        if (magnet === "") return;

        common.onAdd();
        if (existingTorrent === undefined) {
            addMutation.mutate(
                {
                    url: magnet,
                    downloadDir: common.location.path,
                    labels: common.props.labels,
                    paused: !common.start,
                    priority: common.priority,
                },
            );
            common.location.addPath(common.location.path);
        } else {
            mutateAddTrackers(
                { torrentId: existingTorrent.id, trackers: magnetData?.trackers ?? [] },
                {
                    onSuccess: () => {
                        notifications.show({
                            message: "Trackers updated",
                            color: "green",
                        });
                    },
                },
            );
        }
        setMagnet("");
        close();
    }, [existingTorrent, close, addMutation, magnet, common, mutateAddTrackers, magnetData]);

    const config = useContext(ConfigContext);
    const shouldOpen = !config.values.interface.skipAddDialog || typeof props.uri !== "string";
    useEffect(() => {
        if (props.opened && !shouldOpen) {
            onAdd();
        }
    }, [onAdd, props.opened, shouldOpen]);

    return <>{props.opened && shouldOpen &&
        <HkModal opened={true} onClose={close} centered size="lg"
            styles={{ title: { flexGrow: 1 } }}
            title={<Flex w="100%" align="center" justify="space-between">
                <span>Add torrent by magnet link or URL</span>
                {TAURI && <TabSwitchDropdown tabsRef={props.tabsRef} />}
            </Flex>} >
            <Divider my="sm" />
            <TextInput
                label="Link" w="100%"
                value={magnet}
                onChange={(e) => { setMagnet(e.currentTarget.value); }}
                error={existingTorrent === undefined
                    ? undefined
                    : "Torrent already exists"}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" />
            <AddCommon {...common.props} disabled={existingTorrent !== undefined} />
            <Divider my="sm" />
            <Group position="center" spacing="md">
                <Button onClick={onAdd} variant="filled" data-autofocus
                    disabled={existingTorrent !== undefined && (magnetData?.trackers.length ?? 0) === 0}>
                    {existingTorrent === undefined ? "Add" : "Add trackers"}
                </Button>
                <Button onClick={props.close} variant="light">Cancel</Button>
            </Group>
        </HkModal>}
    </>;
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

function useTauriReadFile(
    props: AddCommonModalProps,
    torrentData: TorrentFileData[] | undefined,
    setTorrentData: React.Dispatch<React.SetStateAction<TorrentFileData[] | undefined>>,
) {
    useEffect(() => {
        if (TAURI && props.opened && torrentData === undefined) {
            const readFile = async (path: string | string[] | null) => {
                if (path == null) {
                    return undefined;
                }
                if (Array.isArray(path)) {
                    return await Promise.all(path.map(
                        async (p) => await invoke<TorrentFileData>("read_file", { path: p })));
                }
                return [await invoke<TorrentFileData>("read_file", { path })];
            };

            let uri = props.uri;
            if (typeof uri === "string" && uri.startsWith("file://")) {
                uri = decodeURIComponent(uri.substring(7));
            }

            const pathPromise = typeof uri === "string"
                ? Promise.resolve(uri)
                : dialogOpen({
                    title: "Select torrent file",
                    filters: [{
                        name: "Torrent",
                        extensions: ["torrent"],
                    }],
                    multiple: true,
                });

            pathPromise.then(readFile)
                .then((torrentData) => {
                    setTorrentData(torrentData);
                    if (torrentData === undefined) {
                        props.close();
                    }
                }).catch((e) => {
                    notifications.show({
                        title: "Error reading torrent",
                        message: String(e),
                        color: "red",
                    });
                    props.close();
                });
        }
    }, [props, setTorrentData, torrentData]);
}

function useWebappReadFile(
    props: AddCommonModalProps,
    filesInputRef: React.RefObject<HTMLInputElement>,
    close: () => void,
    setTorrentData: React.Dispatch<React.SetStateAction<TorrentFileData[] | undefined>>,
) {
    useEffect(() => {
        if (!TAURI && props.opened) {
            if (props.uri === undefined) {
                if (filesInputRef.current != null) {
                    filesInputRef.current.value = "";
                    filesInputRef.current.click();
                }
                close();
            } else {
                const file = props.uri as File;
                readLocalTorrent(file).then((b64) => {
                    setTorrentData([{
                        torrentPath: "",
                        metadata: b64,
                        name: file.name,
                        hash: "",
                        files: null,
                        trackers: [],
                        length: 0,
                    }]);
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
    }, [props.opened, props.uri, close, filesInputRef, setTorrentData]);
}

function useFilesInput(
    filesInputRef: React.RefObject<HTMLInputElement>,
    close: () => void,
    setTorrentData: React.Dispatch<TorrentFileData[] | undefined>,
) {
    useEffect(() => {
        const input = filesInputRef.current;
        const fileInputListener = (e: Event) => {
            const element = e.target as HTMLInputElement;
            if (element.files == null) {
                close();
            } else {
                const files = [...element.files];
                Promise.all(files.map(readLocalTorrent)).then((filesData) => {
                    setTorrentData(filesData.map((b64, i) => ({
                        torrentPath: "",
                        metadata: b64,
                        name: files[i].name,
                        hash: "",
                        files: null,
                        trackers: [],
                        length: 0,
                    })));
                }).catch((e) => {
                    notifications.show({
                        title: "Error reading file",
                        message: e,
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
    trackers: string[],
    length: number,
}

export function AddTorrent(props: AddCommonModalProps) {
    const config = useContext(ConfigContext);
    const serverData = useServerTorrentData();
    const common = useCommonProps(props.opened);
    const [torrentData, setTorrentData] = useState<TorrentFileData[]>();

    const existingTorrent = useMemo(() => {
        if (torrentData !== undefined && torrentData.length === 1) {
            return serverData.torrents.find((t) => t.hashString === torrentData[0].hash);
        }
        return undefined;
    }, [serverData.torrents, torrentData]);

    const { close } = props;

    const filesInputRef = useRef<HTMLInputElement>(null);

    useFilesInput(filesInputRef, close, setTorrentData);
    useWebappReadFile(props, filesInputRef, close, setTorrentData);
    useTauriReadFile(props, torrentData, setTorrentData);

    const fileTree = useMemo(() => new CachedFileTree(torrentData?.[0]?.hash ?? "", -1), [torrentData]);
    const [wantedSize, setWantedSize] = useState(0);

    const { data, refetch } = useFileTree("filetreebrief", fileTree);
    useEffect(() => {
        if (torrentData === undefined) return;

        if (torrentData.length === 1 && torrentData[0].files != null) {
            fileTree.parse(torrentData[0], true);
            setWantedSize(fileTree.getWantedSize());
            void refetch();
        } else {
            const totalSize = torrentData.reduce((total, { length }) => total + length, 0);
            setWantedSize(totalSize);
        }
    }, [torrentData, fileTree, refetch]);

    const unwantedHandler = useUnwantedFiles(fileTree, false);

    const onCheckboxChange = useCallback((entryPath: string, state: boolean) => {
        unwantedHandler(entryPath, state);
        setWantedSize(fileTree.getWantedSize());
    }, [fileTree, unwantedHandler]);

    const setAllWanted = useCallback((wanted: boolean) => {
        onCheckboxChange(fileTree.tree.fullpath, wanted);
        void refetch();
    }, [fileTree, onCheckboxChange, refetch]);

    const addMutation = useAddTorrent(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useCallback((response: any, vars: TorrentAddQueryParams) => {
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
            if (TAURI && config.values.app.deleteAdded && vars.filePath !== undefined) {
                void invoke("remove_file", { path: vars.filePath });
            }
        }, [config.values.app.deleteAdded]),
        useCallback((e) => {
            console.error("Failed to add torrent:", e);
            notifications.show({
                title: "Error adding torrent",
                message: String(e),
                color: "red",
            });
        }, []),
    );
    const mutateAddTrackers = useTorrentAddTrackers();

    const onAdd = useCallback(() => {
        if (torrentData === undefined) return;

        common.onAdd();

        if (existingTorrent === undefined) {
            void Promise.all(torrentData.map(async (td) => {
                return await addMutation.mutateAsync(
                    {
                        metainfo: td.metadata,
                        downloadDir: common.location.path,
                        labels: common.props.labels,
                        paused: !common.start,
                        priority: common.priority,
                        unwanted: (td.files == null || torrentData.length > 1) ? undefined : fileTree.getUnwanted(),
                        filePath: td.torrentPath,
                    },
                );
            }));

            common.location.addPath(common.location.path);
        } else {
            mutateAddTrackers(
                { torrentId: existingTorrent.id, trackers: torrentData[0].trackers },
                {
                    onSuccess: () => {
                        notifications.show({
                            message: "Trackers updated",
                            color: "green",
                        });
                    },
                    onSettled: () => {
                        if (TAURI && config.values.app.deleteAdded && torrentData[0].torrentPath !== undefined) {
                            void invoke("remove_file", { path: torrentData[0].torrentPath });
                        }
                    },
                },
            );
        }
        setTorrentData(undefined);
        close();
    }, [torrentData, existingTorrent, close, common, addMutation, fileTree, mutateAddTrackers, config]);

    const shouldOpen = !config.values.interface.skipAddDialog && torrentData !== undefined;
    useEffect(() => {
        if (torrentData !== undefined && !shouldOpen) {
            onAdd();
        }
    }, [onAdd, torrentData, shouldOpen]);

    const modalClose = useCallback(() => {
        setTorrentData(undefined);
        close();
    }, [close]);

    const names = useMemo(() => {
        if (torrentData === undefined) return [];

        return torrentData.map((td) => td.name);
    }, [torrentData]);

    const torrentExists = existingTorrent !== undefined;

    const [fullScreen, toggleFullScreen] = useToggle();

    return (<>
        {!TAURI && <input ref={filesInputRef} type="file" accept=".torrent" multiple
            style={{ position: "absolute", top: "-20rem", zIndex: -1 }} />}
        {shouldOpen &&
            <HkModal opened={true} onClose={modalClose} centered size="lg"
                fullScreen={fullScreen}
                styles={{
                    title: { flexGrow: 1 },
                    content: { display: fullScreen ? "flex" : "block", flexDirection: "column" },
                    body: { display: fullScreen ? "flex" : "block", flexDirection: "column", flexGrow: 1 },
                }}
                title={<Flex w="100%" align="center">
                    <span>Add torrent</span>
                    <Box sx={{ flexGrow: 1 }} />
                    {TAURI && <>
                        <TabSwitchDropdown tabsRef={props.tabsRef} />
                        <ActionIcon onClick={() => { toggleFullScreen(); }}>
                            {fullScreen ? <Icon.FullscreenExit /> : <Icon.ArrowsFullscreen />}
                        </ActionIcon>
                    </>}
                </Flex>} >
                <Divider my="sm" />
                {torrentExists
                    ? <Text color="red" fw="bold" fz="lg">Torrent already exists</Text>
                    : <LimitedNamesList names={names} limit={1} />}
                <AddCommon {...common.props} disabled={torrentExists}>
                    {(wantedSize > 0 || torrentData[0].files != null) &&
                        <Text>{bytesToHumanReadableStr(wantedSize)}</Text>}
                    {(torrentData.length > 1 || torrentData[0].files == null)
                        ? <></>
                        : <>
                            <Button variant="subtle" disabled={torrentExists}
                                onClick={() => { setAllWanted(true); }} title="Mark all files wanted">
                                All
                            </Button>
                            <Button variant="subtle" disabled={torrentExists}
                                onClick={() => { setAllWanted(false); }} title="Mark all files unwanted">
                                None
                            </Button>
                        </>}
                </AddCommon>
                {(torrentData.length > 1 || torrentData[0].files == null)
                    ? <></>
                    : <Box w="100%" h="15rem" sx={{ position: "relative", flexGrow: 1 }}>
                        <FileTreeTable
                            fileTree={fileTree}
                            data={data}
                            brief
                            onCheckboxChange={onCheckboxChange} />
                    </Box>
                }
                <Divider my="sm" />
                <Group position="center" spacing="md">
                    <Button onClick={onAdd} variant="filled" data-autofocus
                        disabled={torrentExists && torrentData[0].trackers.length === 0}>
                        {!torrentExists ? "Add" : "Add trackers"}
                    </Button>
                    <Button onClick={modalClose} variant="light">Cancel</Button>
                </Group>
            </HkModal >}
    </>);
}
