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

import { ConfigContext, ServerConfigContext } from "../config";
import type { ServerConfig } from "../config";
import React, { useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Server } from "../components/server";
import * as Icon from "react-bootstrap-icons";
import { AppSettingsModal } from "./modals/settings";
import { ClientManager } from "../clientmanager";
import { ActionIcon, Box, Button, Flex, Menu, Stack, Tabs, useMantineColorScheme } from "@mantine/core";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "queries";
import { Notifications } from "@mantine/notifications";
import { ClientContext } from "rpc/client";
import { useFontSize } from "fontsize";
import { ColorSchemeToggle, ShowVersion } from "components/miscbuttons";
import { modKeyString } from "trutil";

const { appWindow, invoke, makeCreateTorrentView } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface ServerTabsProps {
    clientManager: ClientManager,
    setCurrentServer: React.Dispatch<ServerConfig | undefined>,
    setServers: React.Dispatch<ServerConfig[]>,
}

interface ServerTabsRef {
    openTab: (tab: string) => void,
    configureServers: () => void,
}

function FontSizeToggle() {
    const { toggle } = useFontSize();

    useHotkeys([
        ["mod + =", () => { toggle(); }],
    ]);

    return (
        <ActionIcon
            variant="default"
            size="lg"
            onClick={() => { toggle(); }}
            title={`Toggle font size (${modKeyString()} + =)`}
            my="auto"
        >
            <Icon.Fonts size="1.1rem" />
        </ActionIcon>
    );
}

interface PassEventData {
    from: string,
    payload: string,
}

function CreateTorrentButton() {
    const { colorScheme } = useMantineColorScheme();

    useEffect(() => {
        const unlisten = appWindow.listen<PassEventData>("pass-from-window", ({ payload: data }) => {
            if (data.payload === "ready") {
                console.log("full send", data, colorScheme);
                void invoke("pass_to_window", { to: data.from, payload: colorScheme });
            }
        });
        return () => { void unlisten.then((u) => { u(); }); };
    }, [colorScheme]);

    const onClick = useCallback(() => {
        void makeCreateTorrentView();
    }, []);

    useHotkeys([
        ["mod + T", onClick],
    ]);

    return (
        <ActionIcon
            variant="default"
            size="lg"
            onClick={onClick}
            title={`Create new torrent file (${modKeyString()} + T)`}
            my="auto"
        >
            <Icon.Stars size="1.1rem" />
        </ActionIcon>
    );
}

const ServerTabs = React.forwardRef<ServerTabsRef, ServerTabsProps>(function ServerTabs(props, ref) {
    const config = useContext(ConfigContext);
    const servers = config.getServers();

    const [tabs, setTabs] = useState({
        openTabs: config.getOpenTabs(),
        currentTab: 0,
    });

    useEffect(() => {
        config.setOpenTabs(tabs.openTabs);
        if (tabs.currentTab < tabs.openTabs.length) {
            const tab = tabs.openTabs[tabs.currentTab];
            void appWindow.setTitle(`Transmission GUI - ${tab}`);
        }
    }, [config, tabs]);

    useEffect(() => {
        const pollerConfigs = tabs.openTabs.filter((_, i) => i !== tabs.currentTab).map((t) => {
            const serverConfig = config.getServer(t) as ServerConfig;
            return {
                name: serverConfig.name,
                connection: serverConfig.connection,
                interval: serverConfig.intervals.torrentsMinimized,
            };
        });
        void invoke("set_poller_config", { configs: pollerConfigs, toast: config.values.app.toastNotifications });
    }, [config, servers, config.values.app.toastNotifications, tabs]);

    const { setCurrentServer, setServers } = props;

    const tabSwitch = useCallback((tab: number) => {
        setCurrentServer(config.getServer(tabs.openTabs[tab]));
        setTabs({ ...tabs, currentTab: tab });
    }, [config, setCurrentServer, tabs]);

    useHotkeys([
        ["mod + TAB", useCallback(() => {
            tabSwitch((tabs.currentTab + 1) % tabs.openTabs.length);
        }, [tabSwitch, tabs])],
        ["mod + shift + TAB", useCallback(() => {
            tabSwitch((tabs.currentTab + tabs.openTabs.length - 1) % tabs.openTabs.length);
        }, [tabSwitch, tabs])],
    ]);

    const openTab = useCallback((name: string) => {
        if (tabs.openTabs.includes(name)) return;
        props.clientManager.open(name, config.values.app.toastNotifications);
        setCurrentServer(config.getServer(name));
        setTabs({ ...tabs, openTabs: [...tabs.openTabs, name], currentTab: tabs.openTabs.length });
    }, [tabs, props.clientManager, setCurrentServer, config]);

    const closeTab = useCallback((tab: number) => {
        if (tab >= tabs.openTabs.length) return;

        props.clientManager.close(tabs.openTabs[tab]);

        const newTabs = {
            openTabs: tabs.openTabs.filter((_, i) => i !== tab),
            currentTab: tabs.currentTab,
        };

        if (tabs.currentTab > tab ||
            (tabs.currentTab === tab && newTabs.currentTab === tabs.openTabs.length - 1)) {
            newTabs.currentTab -= 1;
        }

        setCurrentServer(config.getServer(newTabs.openTabs[newTabs.currentTab]));
        setTabs(newTabs);
    }, [tabs, props.clientManager, setCurrentServer, config]);

    const unopenedTabs = useMemo(() => {
        return servers.filter((s) => !tabs.openTabs.includes(s.name)).map((s) => s.name);
    }, [servers, tabs.openTabs]);

    const [showServerConfig, serverConfigHandlers] = useDisclosure(false);

    useImperativeHandle(ref, () => ({
        openTab,
        configureServers: serverConfigHandlers.open,
    }));

    const onServerSave = useCallback((servers: ServerConfig[]) => {
        const newOpenTabs: string[] = [];
        tabs.openTabs.forEach((serverName) => {
            props.clientManager.close(serverName);
            if (servers.find((s) => s.name === serverName) !== undefined) {
                props.clientManager.open(serverName, config.values.app.toastNotifications);
                newOpenTabs.push(serverName);
            }
        });
        setTabs({
            openTabs: newOpenTabs,
            currentTab: 0,
        });
        setCurrentServer(config.getServer(newOpenTabs[0]));
        setServers(servers);
    }, [tabs.openTabs, setCurrentServer, setServers, config, props.clientManager]);

    return (<>
        <AppSettingsModal
            onSave={onServerSave}
            opened={showServerConfig} close={serverConfigHandlers.close} />
        <Tabs
            variant="outline"
            radius="lg"
            value={String(tabs.currentTab)}
            onTabChange={(value) => { tabSwitch(Number(value)); }}
            styles={(theme) => ({
                tab: {
                    flexBasis: "12rem",
                    flexShrink: 1,
                },
                tabLabel: {
                    marginInline: "auto",
                    color: theme.colors.gray[6],
                    "[data-active] &": {
                        color: theme.colorScheme === "dark" ? theme.colors.gray[3] : theme.colors.dark[8],
                    },
                },
                tabRightSection: {
                    padding: "0.2rem",
                },
                tabsList: {
                    flexWrap: "nowrap",
                },
            })}
        >
            <Tabs.List px="sm">
                {tabs.openTabs.map((name, index) =>
                    <Tabs.Tab
                        key={index}
                        value={String(index)}
                        rightSection={
                            <Icon.XLg size="1.1rem" onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                closeTab(index);
                            }} />
                        }
                    >
                        {name}
                    </Tabs.Tab>)}
                {unopenedTabs.length > 0
                    ? <Menu shadow="md" width={200} position="bottom-start">
                        <Menu.Target>
                            <ActionIcon variant="subtle" color="secondaryColorName" my="auto">
                                <Icon.PlusLg size="1.1rem" />
                            </ActionIcon>
                        </Menu.Target>

                        <Menu.Dropdown>
                            <Menu.Label>Connect</Menu.Label>
                            {unopenedTabs.map((tab) =>
                                <Menu.Item key={tab} onClick={() => { openTab(tab); }}>{tab}</Menu.Item>)
                            }
                        </Menu.Dropdown>
                    </Menu>
                    : <></>}
                <ShowVersion btn="lg" />
                <ColorSchemeToggle btn="lg" />
                <FontSizeToggle />
                <CreateTorrentButton />
                <ActionIcon
                    size="lg" variant="default" my="auto"
                    title="Configure servers"
                    onClick={serverConfigHandlers.open}>
                    <Icon.GearFill size="1.1rem" />
                </ActionIcon>
            </Tabs.List>
        </Tabs>
    </>);
});

export function App(props: React.PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            <Notifications limit={3} style={{ bottom: "2.5rem" }} />
            {props.children}
            <ReactQueryDevtools toggleButtonProps={{ style: { marginBottom: "2rem" } }} />
        </QueryClientProvider>
    );
}

export default function TauriApp() {
    const config = useContext(ConfigContext);
    const clientManager = useMemo(() => {
        const cm = new ClientManager(config);
        config.getOpenTabs().forEach((tab) => { cm.open(tab, config.values.app.toastNotifications); });
        return cm;
    }, [config]);

    const tabsRef = useRef<ServerTabsRef>(null);

    const [currentServer, setCurrentServer] = useState<ServerConfig | undefined>(
        config.getServer(config.getOpenTabs()[0]));
    const [servers, setServers] = useState(config.getServers());

    return (
        <App>
            <Flex direction="column" h="100%" w="100%" >
                <ServerTabs ref={tabsRef}
                    clientManager={clientManager}
                    setCurrentServer={setCurrentServer}
                    setServers={setServers} />
                {currentServer !== undefined
                    ? <ServerConfigContext.Provider value={currentServer}>
                        <ClientContext.Provider value={clientManager.getClient(currentServer.name)}>
                            <Server hostname={clientManager.getHostname(currentServer.name)} />
                        </ClientContext.Provider>
                    </ServerConfigContext.Provider>
                    : <Flex justify="center" align="center" w="100%" h="100%">
                        <Stack mih="20rem">
                            {servers.map((s, i) => {
                                return <Button key={i} variant="subtle"
                                    onClick={() => tabsRef.current?.openTab(s.name)}>{s.name}
                                </Button>;
                            })}
                            <Box sx={{ flexGrow: 1 }} />
                            <Button onClick={() => tabsRef.current?.configureServers()}>
                                Configure servers
                            </Button>
                        </Stack>
                    </Flex>
                }
            </Flex>
        </App>
    );
}
