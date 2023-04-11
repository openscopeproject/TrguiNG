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

import { Button, Checkbox, Divider, Group, Modal, Text, TextInput } from "@mantine/core";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActionModalState, TorrentsNames } from "./common";
import { dialog } from "@tauri-apps/api";
import { ServerConfigContext } from "config";
import { pathMapFromServer, pathMapToServer } from "util";

export function MoveModal(props: ActionModalState) {
    const serverConfig = useContext(ServerConfigContext);

    const [moveData, setMoveData] = useState<boolean>(true);
    const [location, setLocation] = useState<string>("");

    const onDelete = useCallback(() => {
        props.actionController.run("changeDirectory", location, moveData).catch(console.log);
        props.close();
    }, [props.actionController, moveData]);

    const initialLocation = useMemo(() => {
        const [id] = props.actionController.selectedTorrents;
        const torrent = props.actionController.torrents.find((t) => t.id == id);
        return torrent?.downloadDir || "";
    }, [props.actionController.torrents, props.actionController.selectedTorrents]);

    useEffect(() => {
        setLocation(initialLocation);
    }, [initialLocation]);

    const browseHandler = useCallback(async () => {
        let mappedLocation = pathMapFromServer(location, serverConfig);
        console.log(mappedLocation);
        let directory = await dialog.open({
            title: "Select directory",
            defaultPath: mappedLocation,
            directory: true
        }) as string | null;
        if (!directory) return;
        setLocation(pathMapToServer(directory.replace("\\", "/"), serverConfig));
    }, [serverConfig, location]);

    return (
        <Modal opened={props.opened} onClose={props.close} title="Move torrents" centered size="lg">
            <Divider my="sm" />
            <Text mb="md">Enter new location for</Text>
            <TorrentsNames actionController={props.actionController} />
            <Group>
                <TextInput
                    value={location}
                    onChange={(e) => setLocation(e.currentTarget.value)}
                    styles={{
                        root: {
                            flexGrow: 1
                        }
                    }} />
                <Button onClick={browseHandler}>Browse</Button>
            </Group>
            <Checkbox
                label="Move torrent data to new location"
                checked={moveData}
                onChange={(e) => setMoveData(e.currentTarget.checked)}
                my="xl" />
            <Divider my="sm" />
            <Group position="center" spacing="md">
                <Button onClick={onDelete} variant="filled" color="red">{moveData ? "Delete" : "Remove"}</Button>
                <Button onClick={props.close} variant="light">Cancel</Button>
            </Group>
        </Modal>
    );
}
