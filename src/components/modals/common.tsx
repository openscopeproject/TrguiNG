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

import { Badge, Button, CloseButton, Divider, Group, Loader, Modal, type ModalProps, MultiSelect, type MultiSelectValueProps, Text, TextInput } from "@mantine/core";
import { dialog } from "@tauri-apps/api";
import { type ActionController } from "actions";
import { ServerConfigContext } from "config";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { pathMapFromServer, pathMapToServer } from "util";

export interface ModalState {
    opened: boolean,
    close: () => void,
}

export interface ActionModalState extends ModalState {
    actionController: ActionController,
}

interface SaveCancelModalProps extends ModalProps {
    onSave: () => void,
    onClose: () => void,
    saveLoading?: boolean,
}

export function SaveCancelModal({ onSave, onClose, children, saveLoading, ...other }: SaveCancelModalProps) {
    return (
        <Modal onClose={onClose} {...other}>
            <Divider my="sm" />
            {children}
            <Divider my="sm" />
            <Group position="center" spacing="md">
                <Button onClick={onSave} variant="filled">
                    {saveLoading === true ? <Loader size="1rem" /> : "Save"}
                </Button>
                <Button onClick={onClose} variant="light">Cancel</Button>
            </Group>
        </Modal>
    );
}

function useTorrentsNameString(actionController: ActionController) {
    return useMemo<string[]>(() => {
        if (actionController.selectedTorrents.size === 0) {
            return ["No torrent selected"];
        }

        const selected = actionController.torrents.filter(
            (t) => actionController.selectedTorrents.has(t.id));

        const allNames: string[] = [];
        selected.forEach((t) => allNames.push(t.name));
        const names: string[] = allNames.slice(0, 5);

        if (allNames.length > 5) names.push(`... and ${allNames.length - 5} more`);

        return names;
    }, [actionController.selectedTorrents, actionController.torrents]);
}

export function TorrentsNames({ actionController }: { actionController: ActionController }) {
    const names = useTorrentsNameString(actionController);

    return <>
        {names.map((s, i) => <Text key={i} ml="xl" mb="md">{s}</Text>)}
    </>;
}

export interface LocationData {
    path: string,
    setPath: (s: string) => void,
    browseHandler: () => void,
    inputLabel?: string,
}

export function useTorrentLocation(): LocationData {
    const serverConfig = useContext(ServerConfigContext);
    const [path, setPath] = useState<string>("");

    const browseHandler = useCallback(() => {
        const mappedLocation = pathMapFromServer(path, serverConfig);
        console.log(mappedLocation);
        dialog.open({
            title: "Select directory",
            defaultPath: mappedLocation,
            directory: true
        }).then((directory) => {
            if (directory === null) return;
            setPath(pathMapToServer((directory as string).replace("\\", "/"), serverConfig));
        }).catch(console.error);
    }, [serverConfig, path, setPath]);

    return { path, setPath, browseHandler };
}

export function TorrentLocation(props: LocationData) {
    return (
        <Group align="flex-end">
            <TextInput
                value={props.path}
                label={props.inputLabel}
                onChange={(e) => { props.setPath(e.currentTarget.value); }}
                styles={{
                    root: {
                        flexGrow: 1
                    }
                }} />
            <Button onClick={props.browseHandler}>Browse</Button>
        </Group>
    );
}

export interface LabelsData {
    allLabels: string[],
    labels: string[],
    setLabels: React.Dispatch<React.SetStateAction<string[]>>,
    inputLabel?: string,
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

export function TorrentLabels(props: LabelsData) {
    const [data, setData] = useState<string[]>([]);

    useEffect(() => { setData(props.allLabels); }, [props.allLabels]);

    return (
        <MultiSelect
            data={data}
            value={props.labels}
            onChange={props.setLabels}
            label={props.inputLabel}
            withinPortal
            searchable
            creatable
            getCreateLabel={(query) => `+ Add ${query}`}
            onCreate={(query) => {
                setData((current) => [...current, query]);
                return query;
            }}
            valueComponent={Label}
        />
    );
}
