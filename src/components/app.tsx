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

import { ConfigContext, ServerConfig, ServerConfigContext } from '../config';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Server } from '../components/server';
import * as Icon from "react-bootstrap-icons";
import { ManageServersModal } from './modals/settings';
import { ClientManager } from '../clientmanager';
import { ActionIcon, Menu, Tabs, TabsValue, useMantineColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { invoke } from '@tauri-apps/api';
import { queryClient } from 'queries';
import { Notifications } from '@mantine/notifications';

interface ServerTabsProps {
    openTabs: string[],
    currentTab: number,
    servers: ServerConfig[],
    onTabOpen: ((tab: string) => void),
    onTabClose: ((tab: number) => void),
    onTabSwitch: ((tab: number) => void),
    onServersSave: (servers: ServerConfig[]) => void,
}

function ServerTabs(props: ServerTabsProps) {
    const [showServerConfig, serverConfigHandlers] = useDisclosure(false);
    const unopenedTabs = useMemo(() => {
        return props.servers.filter((s) => !props.openTabs.includes(s.name)).map((s) => s.name);
    }, [props.servers, props.openTabs]);

    const { colorScheme, toggleColorScheme } = useMantineColorScheme();
    const dark = colorScheme === 'dark';

    const onTabsChange = useCallback((value: TabsValue) => {
        props.onTabSwitch(Number(value));
    }, [props.onTabSwitch]);

    return (<>
        <ManageServersModal
            servers={props.servers} onSave={props.onServersSave}
            opened={showServerConfig} close={serverConfigHandlers.close} />
        <Tabs
            variant="outline"
            radius="lg"
            value={props.currentTab >= 0 ? String(props.currentTab) : null}
            onTabChange={onTabsChange}
            styles={() => ({
                tab: {
                    minWidth: "12rem",
                },
                tabLabel: {
                    marginInline: "auto"
                },
                tabRightSection: {
                    padding: "0.2rem"
                }
            })}
        >
            <Tabs.List px="sm">
                {props.openTabs.map((name, index) =>
                    <Tabs.Tab
                        key={index}
                        value={String(index)}
                        rightSection={
                            <Icon.XLg size={16} onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                props.onTabClose(index);
                            }} />
                        }
                    >
                        {name}
                    </Tabs.Tab>
                )}
                {unopenedTabs.length > 0 ?
                    <Menu shadow="md" width={200} position="bottom-start">
                        <Menu.Target>
                            <ActionIcon variant="subtle" color="secondaryColorName" my="auto">
                                <Icon.PlusLg size={16} />
                            </ActionIcon>
                        </Menu.Target>

                        <Menu.Dropdown>
                            <Menu.Label>Connect</Menu.Label>
                            {unopenedTabs.map((tab) =>
                                <Menu.Item key={tab} onClick={() => props.onTabOpen(tab)}>{tab}</Menu.Item>)
                            }
                        </Menu.Dropdown>
                    </Menu>
                    : <></>}
                <ActionIcon
                    variant="default"
                    size="lg"
                    onClick={() => toggleColorScheme()}
                    title="Toggle color scheme"
                    ml="auto"
                    my="auto"
                >
                    {dark ?
                        <Icon.Sun size="1.1rem" color="yellow" />
                        : <Icon.MoonStars size="1.1rem" color="blue" />}
                </ActionIcon>
                <ActionIcon size="lg" variant="default" my="auto" onClick={serverConfigHandlers.open}>
                    <Icon.GearFill size="1.1rem" />
                </ActionIcon>
            </Tabs.List>
        </Tabs>
    </>);
}

export function App({ }) {
    const config = useContext(ConfigContext);
    const [servers, setServers] = useState(config.getServers());
    const [openTabs, setOpenTabs] = useState<string[]>(config.getOpenTabs());
    const [currentTab, setCurrentTab] = useState(-1);
    const clientManager = useMemo(() => new ClientManager(config), [config]);

    useEffect(() => {
        let configs = openTabs.filter((_, i) => i != currentTab).map((t) => {
            let serverConfig = config.getServer(t)!;
            return {
                name: serverConfig.name,
                connection: serverConfig.connection,
                interval: serverConfig.intervals.torrentsMinimized,
            }
        });
        invoke("set_poller_config", { configs });
    }, [config, openTabs, currentTab]);

    useEffect(() => {
        for (let tab of openTabs)
            clientManager.open(tab);
    }, []);

    const server = useRef<ServerConfig | undefined>();

    const tabSwitch = useCallback((tab: number) => {
        server.current = config.getServer(openTabs[tab]);
        if (!server.current) return;
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
    }, [config, openTabs]);

    const openTab = useCallback((name: string) => {
        if (openTabs.includes(name)) return;

        clientManager.open(name);

        openTabs.push(name);
        setOpenTabs(openTabs.slice());

        tabSwitch(openTabs.length - 1);
    }, [openTabs, clientManager]);

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
    }, [openTabs, clientManager, currentTab]);

    return (
        <QueryClientProvider client={queryClient}>
            <Notifications limit={3} style={{bottom: "2.5rem"}}/>
            <div className="d-flex flex-column h-100 w-100">
                <ServerTabs
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
                <ReactQueryDevtools toggleButtonProps={{ style: { marginBottom: "2rem" } }} />
            </div>
        </QueryClientProvider>
    );
}
