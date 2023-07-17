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

import { useDisclosure } from "@mantine/hooks";
import React, { memo, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { EditLabelsModal } from "./editlabels";
import { RemoveModal } from "./remove";
import { MoveModal } from "./move";
import { AddMagnet, AddTorrent } from "./add";
import { DaemonSettingsModal } from "./daemon";
import { EditTorrent } from "./edittorrent";
import type { ServerTabsRef } from "components/servertabs";
const { TAURI, appWindow } = await import(/* webpackChunkName: "taurishim" */"taurishim");

export interface ModalCallbacks {
    setLabels: () => void,
    remove: () => void,
    move: () => void,
    addMagnet: () => void,
    addTorrent: () => void,
    daemonSettings: () => void,
    editTorrent: () => void,
}

interface ServerModalsProps {
    serverName: string,
    runUpdates: (run: boolean) => void,
    tabsRef: React.RefObject<ServerTabsRef>,
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

const ServerModals = React.forwardRef<ModalCallbacks, ServerModalsProps>(function ServerModals(props, ref) {
    const [showLabelsModal, openLabelsModal, closeLabelsModal] = usePausingModalState(props.runUpdates);
    const [showRemoveModal, openRemoveModal, closeRemoveModal] = usePausingModalState(props.runUpdates);
    const [showMoveModal, openMoveModal, closeMoveModal] = usePausingModalState(props.runUpdates);
    const [showAddMagnetModal, openAddMagnetModal, closeAddMagnetModal] = usePausingModalState(props.runUpdates);
    const [showAddTorrentModal, openAddTorrentModal, closeAddTorrentModal] = usePausingModalState(props.runUpdates);
    const [showDaemonSettingsModal, openDaemonSettingsModal, closeDaemonSettingsModal] = usePausingModalState(props.runUpdates);
    const [showEditTorrentModal, openEditTorrentModal, closeEditTorrentModal] = usePausingModalState(props.runUpdates);

    useImperativeHandle(ref, () => ({
        setLabels: openLabelsModal,
        remove: openRemoveModal,
        move: openMoveModal,
        addMagnet: openAddMagnetModal,
        addTorrent: openAddTorrentModal,
        daemonSettings: openDaemonSettingsModal,
        editTorrent: openEditTorrentModal,
    }));

    const [magnetLink, setMagnetLink] = useState<string>();
    const [torrent, setTorrent] = useState<string | File>();

    const [addQueue, setAddQueue] = useState<Array<string | File>>([]);

    const enqueue = useCallback((paths: string[] | File[]) => {
        setAddQueue([...addQueue, ...paths]);
        void appWindow.show();
        void appWindow.unminimize();
        void appWindow.setFocus();
        void appWindow.emit("window-shown");
    }, [addQueue]);

    useEffect(() => {
        if (TAURI) {
            const listenResult = appWindow.listen<string[]>("tauri://file-drop", (event) => {
                const files = event.payload.filter((path) => path.toLowerCase().endsWith(".torrent"));
                if (files.length > 0) enqueue(files);
            });

            return () => { void listenResult.then((unlisten) => { unlisten(); }); };
        } else {
            document.ondragover = (e) => { e.preventDefault(); };
            document.ondrop = (event) => {
                event.preventDefault();

                if (event.dataTransfer?.items !== undefined) {
                    const files = [...event.dataTransfer.items]
                        .filter((i) => i.kind === "file")
                        .map((f) => f.getAsFile() as File);
                    if (files.length > 0) enqueue(files);
                }
            };

            return () => {
                document.ondragover = null;
                document.ondrop = null;
            };
        }
    }, [enqueue]);

    useEffect(() => {
        const listenResult = appWindow.listen<string>("app-arg", (event) => {
            const args = JSON.parse(event.payload) as string[];
            console.log("Got app-arg:", args);
            enqueue(args);
        }).then((unlisten) => {
            void appWindow.emit("listener-start", {});
            return unlisten;
        });

        return () => {
            void listenResult.then((unlisten) => { unlisten(); });
        };
    }, [enqueue]);

    useEffect(() => {
        if (addQueue.length > 0 && !showAddMagnetModal && !showAddTorrentModal) {
            const item = addQueue[0];
            if (typeof item === "string" && item.startsWith("magnet:?")) {
                setMagnetLink(item);
                openAddMagnetModal();
            } else {
                setTorrent(item);
                openAddTorrentModal();
            }
        }
    }, [addQueue, showAddMagnetModal, showAddTorrentModal, setMagnetLink, setTorrent, openAddMagnetModal, openAddTorrentModal]);

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
        if (torrent !== undefined && addQueue.length > 0 && addQueue[0] === torrent) {
            setTorrent(undefined);
            setAddQueue(addQueue.slice(1));
        } else if (addQueue.length > 0) {
            // kick the queue again
            setAddQueue([...addQueue]);
        }
    }, [closeAddTorrentModal, addQueue, torrent]);

    return <>
        <EditLabelsModal
            opened={showLabelsModal} close={closeLabelsModal} />
        <RemoveModal
            opened={showRemoveModal} close={closeRemoveModal} />
        <MoveModal
            opened={showMoveModal} close={closeMoveModal} />
        <AddMagnet
            serverName={props.serverName}
            uri={magnetLink}
            tabsRef={props.tabsRef}
            opened={showAddMagnetModal} close={closeAddMagnetModalAndPop} />
        <AddTorrent
            serverName={props.serverName}
            uri={torrent}
            tabsRef={props.tabsRef}
            opened={showAddTorrentModal} close={closeAddTorrentModalAndPop} />
        <DaemonSettingsModal
            opened={showDaemonSettingsModal} close={closeDaemonSettingsModal} />
        <EditTorrent
            opened={showEditTorrentModal} close={closeEditTorrentModal} />
    </>;
});

export const MemoizedServerModals = memo(ServerModals) as typeof ServerModals;
