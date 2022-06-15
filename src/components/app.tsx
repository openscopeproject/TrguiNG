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

import 'bootstrap/dist/css/bootstrap.min.css';

import { TransmissionClient } from '../rpc/client';
import { Config, ConfigContext, ServerConfig, ServerConfigContext } from '../config';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { Server } from '../components/server';
import * as Icon from "react-bootstrap-icons";
import { Button } from 'react-bootstrap';
import { ManageServersModal } from './modals';

interface TabsProps {
    servers: ServerConfig[],
    onServersSave: (servers: ServerConfig[]) => void,
}

function Tabs(props: TabsProps) {
    const [showServerConfig, setShowServerConfig] = useState(false);

    return (<>
        <ManageServersModal
            servers={props.servers} onSave={props.onServersSave}
            show={showServerConfig} setShow={setShowServerConfig} />
        <div className="d-flex app-tab-row">
            <div className="app-tab active">
                <div className="d-flex">
                    <div className="flex-grow-1">
                        r710
                    </div>
                    <div>
                        <Icon.XLg size={16} />
                    </div>
                </div>
            </div>
            <Button variant="light">
                <Icon.PlusLg size={16} />
            </Button>
            <div className="w-100 flex-shrink-1" />
            <Button variant="light" onClick={() => setShowServerConfig(true)}>
                <Icon.GearFill size={16} />
            </Button>
        </div>
    </>);
}

export function App(_: {}) {
    const config = useContext(ConfigContext);
    const servers = config.getServers();

    var client = useMemo(() => {
        const client = new TransmissionClient(servers[0].connection);
        client.getSessionFull().catch(console.log);
        return client;
    }, []);

    const onServerSave = useCallback((servers: ServerConfig[]) => {
        console.log("saving servers", servers);
    }, []);

    return (
        <div className="d-flex flex-column h-100 w-100">
            <Tabs servers={servers} onServersSave={onServerSave} />
            <ServerConfigContext.Provider value={servers[0]}>
                <Server client={client} />
            </ServerConfigContext.Provider>
        </div>
    );
}
