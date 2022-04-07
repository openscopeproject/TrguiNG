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

import React, { useEffect, useMemo, useState } from "react";
import Split from "react-split";
import { TransmissionClient } from "../rpc/client";
import { Details } from "./details";
import { DefaultFilter, Filters } from "./filters";
import { TorrentTable } from "./table";
import { Torrent } from "../rpc/torrent";
import '../css/custom.css';

interface ServerProps {
    client: TransmissionClient,
}

export function Server(props: ServerProps) {
    const [torrents, setTorrents] = useState<Torrent[]>([]);
    const [currentTorrent, setCurrentTorrent] = useState<Torrent>();
    const [currentFilter, setCurrentFilter] = useState({id: "", filter: DefaultFilter});
    const [timer, setTimer] = useState(0);

    const loadTorrentDetails = useMemo(() => (t: Torrent) => {
        props.client.getTorrentDetails(t.id)
            .then(setCurrentTorrent)
            .catch(console.log);
    }, [props.client]);

    useEffect(() => {
        props.client.getTorrents().then(setTorrents).catch(console.log);

        setTimer(setInterval(() => {
            props.client.getTorrents().then(setTorrents).catch(console.log);
        }, 5000));

        return () => clearInterval(timer);
    }, [props.client]);

    return (
        <div className="d-flex flex-column h-100 w-100">
            <div className="border-bottom border-dark">
                <h1>Toolbar placeholder</h1>
            </div>
            <div className="flex-grow-1">
                <Split
                    direction="vertical"
                    sizes={[70, 30]}
                    gutterSize={8}
                    snapOffset={0}
                    className="split-vertical"
                >
                    <Split
                        direction="horizontal"
                        sizes={[20, 80]}
                        gutterSize={8}
                        snapOffset={0}
                        className="split-horizontal"
                    >
                        <div className="scrollable">
                            <Filters
                                torrents={torrents}
                                currentFilter={currentFilter}
                                setCurrentFilter={setCurrentFilter} />
                        </div>
                        <div className="scrollable">
                            <TorrentTable
                                torrents={torrents}
                                currentFilter={currentFilter}
                                setCurrentTorrent={loadTorrentDetails} />
                        </div>
                    </Split>
                    <div className="w-100">
                        <Details torrent={currentTorrent} />
                    </div>
                </Split>
            </div>
        </div>
    );
}
