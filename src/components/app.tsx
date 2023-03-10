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
import { ConfigContext, ServerConfig, ServerConfigContext } from '../config';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Server } from '../components/server';
import * as Icon from "react-bootstrap-icons";
import { Button, Dropdown } from 'react-bootstrap';
import { ManageServersModal } from './modals';
import { ClientManager } from '../clientmanager';

interface TabsProps {
    openTabs: string[],
    currentTab: number,
    servers: ServerConfig[],
    onTabOpen: ((tab: string) => void),
    onTabClose: ((tab: number) => void),
    onTabSwitch: ((tab: number) => void),
    onServersSave: (servers: ServerConfig[]) => void,
}

function Tabs(props: TabsProps) {
    const [showServerConfig, setShowServerConfig] = useState(false);
    const unopenedTabs = useMemo(() => {
        return props.servers.filter((s) => !props.openTabs.includes(s.name)).map((s) => s.name);
    }, [props.servers, props.openTabs]);

    return (<>
        <ManageServersModal
            servers={props.servers} onSave={props.onServersSave}
            show={showServerConfig} setShow={setShowServerConfig} />
        <div className="d-flex app-tab-row">
            {props.openTabs.map((tab, index) =>
                <div key={index} className={"d-flex flex-column justify-content-center app-tab " + (index == props.currentTab ? "active" : "")}>
                    <div className="d-flex align-items-center">
                        <div className="flex-grow-1" onClick={() => props.onTabSwitch(index)}>
                            {tab}
                        </div>
                        <div>
                            <Button variant="light" className="p-0" onClick={() => props.onTabClose(index)}>
                                <Icon.XLg size={16} />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {unopenedTabs.length > 0 ?
                <Dropdown>
                    <Dropdown.Toggle size='sm' variant="light" className="p-1">
                        {/* <Icon.PlusLg size={16} /> */}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        {unopenedTabs.map((tab) => <Dropdown.Item key={tab} onClick={() => props.onTabOpen(tab)}>{tab}</Dropdown.Item>)}
                    </Dropdown.Menu>
                </Dropdown>
                : <></>}
            <div className="w-100 flex-shrink-1" />
            <Button variant="light" onClick={() => setShowServerConfig(true)}>
                <Icon.GearFill size={16} />
            </Button>
        </div>
    </>);
}

export function App(_: {}) {
    const config = useContext(ConfigContext);
    const [servers, setServers] = useState(config.getServers());
    const [openTabs, setOpenTabs] = useState<string[]>(config.getOpenTabs());
    const [currentTab, setCurrentTab] = useState(-1);
    const clientManager = useMemo(() => new ClientManager(config), [config]);

    useEffect(() => {
        for (let tab of openTabs)
            clientManager.open(tab);
    }, []);

    const server = useRef<ServerConfig | undefined>();

    const tabSwitch = useCallback((tab: number) => {
        console.log("Tab switch to", tab);
        server.current = config.getServer(openTabs[tab]);
        if (!server.current) return;
        clientManager.setActiveServer(server.current.name);
        setCurrentTab(tab);
    }, [openTabs]);

    useEffect(() => { tabSwitch(0) }, []);
    useEffect(() => { config.setOpenTabs(openTabs); }, [openTabs]);

    const onServerSave = useCallback((servers: ServerConfig[]) => {
        config.setServers(servers);
        setServers(servers);
        openTabs.slice().reverse().forEach((serverName, reverseIndex) => {
            if (servers.find((s) => s.name == serverName) === undefined) {
                console.log("Closing tab", serverName);
                closeTab(openTabs.length - reverseIndex - 1);
            }
        });
    }, [config]);

    const openTab = useCallback((name: string) => {
        if (openTabs.includes(name)) return;

        clientManager.open(name);

        openTabs.push(name);
        setOpenTabs(openTabs.slice());

        tabSwitch(openTabs.length - 1);
    }, [openTabs]);

    const closeTab = useCallback((tab: number) => {
        if (tab >= openTabs.length) return;

        clientManager.close(openTabs[tab]);

        setOpenTabs(openTabs.filter((_, i) => i != tab));

        if (currentTab == tab) {
            var nextTab = currentTab;
            if (nextTab == openTabs.length - 1) nextTab -= 1;
            if (nextTab >= 0) {
                tabSwitch(nextTab)
            } else {
                server.current = undefined;
                setCurrentTab(0);
            }
        } else if (tab < currentTab) {
            setCurrentTab(currentTab - 1);
        }
    }, [openTabs]);

    return (
        <div className="d-flex flex-column h-100 w-100">
            <Tabs
                openTabs={openTabs} onTabOpen={openTab} onTabClose={closeTab}
                currentTab={currentTab} onTabSwitch={tabSwitch}
                servers={servers} onServersSave={onServerSave} />
            {server.current !== undefined ?
                <ServerConfigContext.Provider value={server.current!}>
                    <Server clientManager={clientManager} />
                </ServerConfigContext.Provider>
                : <div className="d-flex justify-content-center align-items-center w-100 h-100">
                    <div className="d-flex flex-column" style={{ minHeight: "10rem", height: "75vh" }}>
                        <div>Open server tab</div>
                        <div className="border border-secondary flex-grow-1" style={{ minHeight: "20rem" }}>
                            {servers.map((s, i) => {
                                return <div key={i} className="p-1" onClick={() => { openTab(s.name) }}>{s.name}</div>;
                            })}
                        </div>
                    </div>
                </div>
            }
        </div>
    );
}
