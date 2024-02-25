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

import type { ModalProps, MultiSelectValueProps } from "@mantine/core";
import {
    Badge, Button, CloseButton, Divider, Group, Loader, Modal, MultiSelect,
    Text, TextInput, ActionIcon, Menu, ScrollArea, useMantineTheme, Box,
} from "@mantine/core";
import { ConfigContext, ServerConfigContext } from "config";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { bytesToHumanReadableStr, pathMapFromServer, pathMapToServer } from "trutil";
import * as Icon from "react-bootstrap-icons";
import { useServerSelectedTorrents, useServerTorrentData } from "rpc/torrent";
import { useHotkeysContext } from "hotkeys";
import { useFreeSpace } from "queries";
import type { Property } from "csstype";
import debounce from "lodash-es/debounce";
const { TAURI, dialogOpen } = await import(/* webpackChunkName: "taurishim" */"taurishim");

export interface ModalState {
    opened: boolean,
    close: () => void,
}

export function HkModal(props: ModalProps) {
    const hk = useHotkeysContext();

    useEffect(() => {
        hk.active = !props.opened;

        return () => { hk.active = true; };
    }, [props.opened, hk]);

    return <Modal {...props}>{props.children}</Modal>;
}

interface SaveCancelModalProps extends ModalProps {
    onSave: () => void,
    onClose: () => void,
    saveLoading?: boolean,
}

export function SaveCancelModal({ onSave, onClose, children, saveLoading, ...other }: SaveCancelModalProps) {
    return (
        <HkModal onClose={onClose} {...other}>
            <Divider my="sm" />
            {children}
            <Divider my="sm" />
            <Group position="center" spacing="md">
                <Button onClick={onSave} variant="filled" data-autofocus>
                    {saveLoading === true ? <Loader size="1rem" /> : "Save"}
                </Button>
                <Button onClick={onClose} variant="light">Cancel</Button>
            </Group>
        </HkModal>
    );
}

export function LimitedNamesList({ names, limit }: { names: string[], limit?: number }) {
    limit = limit ?? 5;
    const t = names.slice(0, limit);

    return <>
        {t.map((s, i) => <Text key={i} mx="md" my="xs" px="sm" sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxShadow: "inset 0 0 0 9999px rgba(133, 133, 133, 0.1)",
        }}>
            {s}
        </Text>)}
        {names.length > limit && <Text mx="xl" mb="md">{`... and ${names.length - limit} more`}</Text>}
    </>;
}

export function TorrentsNames() {
    const serverData = useServerTorrentData();
    const serverSelected = useServerSelectedTorrents();

    const allNames = useMemo<string[]>(() => {
        if (serverData.current == null || serverSelected.size === 0) {
            return ["No torrent selected"];
        }
        return serverData.torrents.filter(
            (t) => serverSelected.has(t.id)).map((t) => t.name);
    }, [serverData, serverSelected]);

    return <LimitedNamesList names={allNames} />;
}

export interface LocationData {
    path: string,
    immediateSetPath: (s: string) => void,
    debouncedSetPath: (s: string) => void,
    lastPaths: string[],
    addPath: (dir: string) => void,
    browseHandler: () => void,
    inputLabel?: string,
    disabled?: boolean,
    focusPath?: boolean,
    freeSpace: ReturnType<typeof useFreeSpace>,
    spaceNeeded?: number,
    insufficientSpace: boolean,
    errorColor: Property.Color | undefined,
}

export interface UseTorrentLocationOptions {
    freeSpaceQueryEnabled: boolean,
    spaceNeeded?: number,
}

export function useTorrentLocation({ freeSpaceQueryEnabled, spaceNeeded }: UseTorrentLocationOptions): LocationData {
    const config = useContext(ConfigContext);
    const serverConfig = useContext(ServerConfigContext);
    const lastPaths = useMemo(() => serverConfig.lastSaveDirs, [serverConfig]);

    const [path, setPath] = useState<string>("");
    const [debouncedPath, setDebouncedPath] = useState(path);

    const immediateSetPath = useCallback((newPath: string) => {
        setPath(newPath);
        setDebouncedPath(newPath);
    }, []);

    const debouncedSetPath = useMemo(() => {
        const debouncedSetter = debounce(setDebouncedPath, 500, { trailing: true, leading: false });
        return (newPath: string) => {
            setPath(newPath);
            debouncedSetter(newPath);
        };
    }, []);

    const freeSpace = useFreeSpace(freeSpaceQueryEnabled, debouncedPath);

    useEffect(() => {
        immediateSetPath(lastPaths.length > 0 ? lastPaths[0] : "");
    }, [lastPaths, immediateSetPath]);

    const browseHandler = useCallback(() => {
        const mappedLocation = pathMapFromServer(path, serverConfig);
        console.log("Mapped location: ", mappedLocation);
        dialogOpen({
            title: "Select directory",
            defaultPath: mappedLocation === "" ? undefined : mappedLocation,
            directory: true,
        }).then((directory) => {
            if (directory === null) return;
            const mappedPath = pathMapToServer((directory as string).replace(/\\/g, "/"), serverConfig);
            immediateSetPath(mappedPath.replace(/\\/g, "/"));
        }).catch(console.error);
    }, [serverConfig, path, immediateSetPath]);

    const addPath = useCallback(
        (dir: string) => { config.addSaveDir(serverConfig.name, dir); },
        [config, serverConfig.name]);

    const theme = useMantineTheme();
    const errorColor = useMemo(
        () => theme.fn.variant({ variant: "filled", color: "red" }).background,
        [theme]);
    const insufficientSpace =
        spaceNeeded != null &&
        !freeSpace.isLoading &&
        !freeSpace.isError &&
        freeSpace.data["size-bytes"] < spaceNeeded;

    return { path, immediateSetPath, debouncedSetPath, lastPaths, addPath, browseHandler, freeSpace, spaceNeeded, insufficientSpace, errorColor };
}

export function TorrentLocation(props: LocationData) {
    const { data: freeSpace, isLoading, isError } = props.freeSpace;
    return (
        <TextInput
            value={props.path}
            label={props.inputLabel}
            disabled={props.disabled}
            onChange={(e) => { props.debouncedSetPath(e.currentTarget.value); }}
            styles={{
                wrapper: { flexGrow: 1 },
                description: {
                    color: props.insufficientSpace ? props.errorColor : undefined,
                },
            }}
            data-autofocus={props.focusPath}
            inputWrapperOrder={["label", "input", "description"]}
            description={
                <Text>
                    {"Free space: "}
                    {isLoading
                        ? <Box ml="xs" component={Loader} variant="dots" size="xs"/>
                        : isError
                            ? "Unknown"
                            : bytesToHumanReadableStr(freeSpace["size-bytes"])}
                </Text>
            }
            inputContainer={
                (children) => <Group align="flex-start">
                    {children}
                    {TAURI && <Button onClick={props.browseHandler} disabled={props.disabled}>Browse</Button>}
                </Group>
            }
            rightSection={
                <Menu position="left-start" withinPortal
                    middlewares={{ shift: true, flip: false }} offset={{ mainAxis: -20, crossAxis: 30 }}>
                    <Menu.Target>
                        <ActionIcon py="md" disabled={props.disabled}>
                            <Icon.ClockHistory size="16" />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <ScrollArea.Autosize
                            type="auto"
                            mah="calc(100vh - 0.5rem)"
                            miw="30rem"
                            offsetScrollbars
                            styles={{ viewport: { paddingBottom: 0 } }}
                        >
                            {props.lastPaths.map((path) => (
                                <Menu.Item key={path} onClick={() => { props.immediateSetPath(path); }}>{path}</Menu.Item>
                            ))}
                        </ScrollArea.Autosize>
                    </Menu.Dropdown>
                </Menu>
            } />
    );
}

function Label({
    label,
    onRemove,
    classNames,
    ...others
}: MultiSelectValueProps) {
    return (
        <div {...others}>
            <Badge radius="md" variant="filled"
                rightSection={
                    <CloseButton
                        onMouseDown={onRemove}
                        variant="transparent"
                        size={22}
                        iconSize={14}
                        tabIndex={-1}
                        mr="-0.25rem"
                    />
                }
            >
                {label}
            </Badge>
        </div>
    );
}

interface TorrentLabelsProps {
    labels: string[],
    setLabels: React.Dispatch<string[]>,
    inputLabel?: string,
    disabled?: boolean,
}

export function TorrentLabels(props: TorrentLabelsProps) {
    const serverData = useServerTorrentData();

    const initialLabelset = useMemo(() => {
        const labels = new Set<string>();
        serverData.torrents.forEach((t) => t.labels?.forEach((l: string) => labels.add(l)));

        return Array.from(labels).sort();
    }, [serverData.torrents]);

    const [data, setData] = useState<string[]>(initialLabelset);

    return (
        <MultiSelect
            data={data}
            value={props.labels}
            onChange={props.setLabels}
            label={props.inputLabel}
            withinPortal
            searchable
            creatable
            disabled={props.disabled}
            getCreateLabel={(query) => `+ Add ${query}`}
            onCreate={(query) => {
                setData((current) => [...current, query]);
                return query;
            }}
            valueComponent={Label}
        />
    );
}
