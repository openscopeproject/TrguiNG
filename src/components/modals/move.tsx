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

import { Button, Checkbox, Divider, Group, Text } from "@mantine/core";
import React, { useCallback, useEffect, useState } from "react";
import type { ModalState } from "./common";
import { HkModal, TorrentLocation, TorrentsNames, useTorrentLocation } from "./common";
import { useTorrentChangeDirectory } from "queries";
import { notifications } from "@mantine/notifications";
import { useServerTorrentData } from "rpc/torrent";

export function MoveModal(props: ModalState) {
    const serverData = useServerTorrentData();
    const [moveData, setMoveData] = useState<boolean>(true);

    const location = useTorrentLocation();
    const { setPath } = location;

    const mutation = useTorrentChangeDirectory();

    const onMove = useCallback(() => {
        mutation.mutate(
            {
                torrentIds: Array.from(serverData.selected),
                location: location.path,
                move: moveData,
            },
            {
                onError: (e) => {
                    console.log("Error moving torrents", e);
                    notifications.show({
                        message: "Error moving torrents",
                        color: "red",
                    });
                },
            },
        );

        props.close();
    }, [mutation, serverData.selected, location.path, moveData, props]);

    const calculateInitialLocation = useCallback(() => {
        const [id] = [...serverData.selected];
        const torrent = serverData.torrents.find((t) => t.id === id);
        return torrent?.downloadDir ?? "";
    }, [serverData]);

    useEffect(() => {
        if (props.opened) setPath(calculateInitialLocation());
    }, [props.opened, setPath, calculateInitialLocation]);

    return (
        <HkModal opened={props.opened} onClose={props.close} title="Move torrents" centered size="lg">
            <Divider my="sm" />
            <Text mb="md">Enter new location for</Text>
            <TorrentsNames />
            <TorrentLocation {...location} />
            <Checkbox
                label="Move torrent data to new location"
                checked={moveData}
                onChange={(e) => { setMoveData(e.currentTarget.checked); }}
                my="xl" />
            <Divider my="sm" />
            <Group position="center" spacing="md">
                <Button onClick={onMove} variant="filled">Move</Button>
                <Button onClick={props.close} variant="light">Cancel</Button>
            </Group>
        </HkModal>
    );
}
