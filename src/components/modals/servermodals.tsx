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

import { useDisclosure } from "@mantine/hooks";
import { emit, listen } from "@tauri-apps/api/event";
import { appWindow } from "@tauri-apps/api/window";
import React, { useCallback, useEffect, useImperativeHandle, useState } from "react";
import type { ServerTorrentData } from "rpc/torrent";
import { EditLabelsModal } from "./editlabels";
import { RemoveModal } from "./remove";
import { MoveModal } from "./move";
import { AddMagnet, AddTorrent } from "./add";
import { DaemonSettingsModal } from "./daemon";

export interface ModalCallbacks {
    setLabels: () => void,
    remove: () => void,
    move: () => void,
    addMagnet: () => void,
    addTorrent: () => void,
    daemonSettings: () => void,
}

interface ServerModalsProps {
    serverData: React.MutableRefObject<ServerTorrentData>,
    runUpdates: (run: boolean) => void,
}

function usePausingModalState(runUpdates: (run: boolean) => void): [boolean, () => void, () => void] {
    const [opened, { open, close }] = useDisclosure(false);

    const pauseOpen = useCallback(() => {
        runUpdates(false);
        open();
    }, [runUpdates, open]);

    const closeResume = useCallback(() => {
        close();
        runUpdates(true);
    }, [runUpdates, close]);

    return [opened, pauseOpen, closeResume];
}

export const ServerModals = React.forwardRef<ModalCallbacks, ServerModalsProps>(function ServerModals(props, ref) {
    const [showLabelsModal, openLabelsModal, closeLabelsModal] = usePausingModalState(props.runUpdates);
    const [showRemoveModal, openRemoveModal, closeRemoveModal] = usePausingModalState(props.runUpdates);
    const [showMoveModal, openMoveModal, closeMoveModal] = usePausingModalState(props.runUpdates);
    const [showAddMagnetModal, openAddMagnetModal, closeAddMagnetModal] = usePausingModalState(props.runUpdates);
    const [showAddTorrentModal, openAddTorrentModal, closeAddTorrentModal] = usePausingModalState(props.runUpdates);
    const [showDaemonSettingsModal, openDaemonSettingsModal, closeDaemonSettingsModal] = usePausingModalState(props.runUpdates);

    useImperativeHandle(ref, () => ({
        setLabels: openLabelsModal,
        remove: openRemoveModal,
        move: openMoveModal,
        addMagnet: openAddMagnetModal,
        addTorrent: openAddTorrentModal,
        daemonSettings: openDaemonSettingsModal,
    }));

    const [magnetLink, setMagnetLink] = useState<string>();
    const [torrentPath, setTorrentPath] = useState<string>();

    const [addQueue, setAddQueue] = useState<string[]>([]);

    useEffect(() => {
        const listenResult = listen<string>("app-arg", (event) => {
            const args = JSON.parse(event.payload) as string[];
            console.log("Got app-arg:", args);
            setAddQueue([...addQueue, ...args]);
            void appWindow.show();
            void appWindow.unminimize();
            void appWindow.setFocus();
            void appWindow.emit("window-shown");
        }).then((unlisten) => {
            void emit("listener-start", {});
            return unlisten;
        });

        return () => {
            void listenResult.then((unlisten) => { unlisten(); });
        };
    }, [addQueue]);

    useEffect(() => {
        if (addQueue.length > 0 && !showAddMagnetModal && !showAddTorrentModal) {
            const item = addQueue[0];
            if (item.startsWith("magnet:?")) {
                setMagnetLink(item);
                openAddMagnetModal();
            } else {
                setTorrentPath(item);
                openAddTorrentModal();
            }
        }
    }, [addQueue, showAddMagnetModal, showAddTorrentModal, setMagnetLink, setTorrentPath, openAddMagnetModal, openAddTorrentModal]);

    const closeAddMagnetModalAndPop = useCallback(() => {
        closeAddMagnetModal();
        if (magnetLink !== undefined && addQueue.length > 0 && addQueue[0] === magnetLink) {
            setMagnetLink(undefined);
            setAddQueue(addQueue.slice(1));
        } else if (addQueue.length > 0) {
            // kick the queue again
            setAddQueue([...addQueue]);
        }
    }, [closeAddMagnetModal, addQueue, magnetLink]);

    const closeAddTorrentModalAndPop = useCallback(() => {
        closeAddTorrentModal();
        if (torrentPath !== undefined && addQueue.length > 0 && addQueue[0] === torrentPath) {
            setTorrentPath(undefined);
            setAddQueue(addQueue.slice(1));
        } else if (addQueue.length > 0) {
            // kick the queue again
            setAddQueue([...addQueue]);
        }
    }, [closeAddTorrentModal, addQueue, torrentPath]);

    return <>
        <EditLabelsModal
            serverData={props.serverData}
            opened={showLabelsModal} close={closeLabelsModal} />
        <RemoveModal
            serverData={props.serverData}
            opened={showRemoveModal} close={closeRemoveModal} />
        <MoveModal
            serverData={props.serverData}
            opened={showMoveModal} close={closeMoveModal} />
        <AddMagnet
            serverData={props.serverData}
            uri={magnetLink}
            opened={showAddMagnetModal} close={closeAddMagnetModalAndPop} />
        <AddTorrent
            serverData={props.serverData}
            uri={torrentPath}
            opened={showAddTorrentModal} close={closeAddTorrentModalAndPop} />
        <DaemonSettingsModal
            opened={showDaemonSettingsModal} close={closeDaemonSettingsModal} />
    </>;
});
