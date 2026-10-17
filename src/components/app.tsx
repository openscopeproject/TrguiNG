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
import React, { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Server } from "../components/server";
import { ClientManager } from "../clientmanager";
import { ActionIcon, Box, Button, Flex, Menu, Stack, useComputedColorScheme } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "queries";
import { Notifications } from "@mantine/notifications";
import { ClientContext } from "rpc/client";
import type { ServerTabsRef } from "./servertabs";
import { ServerTabs } from "./servertabs";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import * as Icon from "react-bootstrap-icons";
import { modKeyString } from "trutil";
import { ColorSchemeToggle, FontSizeToggle, ShowVersion } from "./miscbuttons";
import { AppSettingsModal } from "./modals/settings";
import { ToolbarButton } from "./toolbar";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "css/custom.css";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n, { initializeI18n, synchronizeNativeLanguage } from "i18n";
import { Loader } from "@mantine/core";

const { TAURI, appWindow, invoke, makeCreateTorrentView } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface PassEventData {
    from: string,
    payload: string,
}

function CreateTorrentButton() {
    const { t } = useTranslation();
    const config = useContext(ConfigContext);
    const colorScheme = useComputedColorScheme();

    useEffect(() => {
        const unlisten = appWindow.listen<PassEventData>("pass-from-window", ({ payload: data }) => {
            if (data.payload === "ready") {
                void invoke("pass_to_window", {
                    to: data.from,
                    payload: JSON.stringify({ colorScheme, defaultTrackers: config.values.interface.defaultTrackers, language: config.values.app.language }),
                });
            }
        });
        return () => {
            void unlisten.then((u) => {
                u();
            });
        };
    }, [colorScheme, config]);

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
            title={t("toolbar.createTorrentWithHotkey", { hotkey: modKeyString() })}
            my="auto"
        >
            <Icon.Stars size="1.1rem" />
        </ActionIcon>
    );
}

export function App(props: React.PropsWithChildren) {
    const config = useContext(ConfigContext);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let active = true;
        let stopNativeSync: (() => void) | undefined;
        const initialize = async () => {
            await initializeI18n(config.values.app.language);
            if (!active) return;
            if (TAURI) {
                const nativeSync = synchronizeNativeLanguage(async (language) => await invoke("set_language", { language }));
                stopNativeSync = nativeSync.stop;
                await nativeSync.ready;
                if (!active) return;
                if (config.values.app.showTrayIcon) void invoke("create_tray").catch(console.error);
            }
            if (active) setReady(true);
        };
        void initialize().catch(console.error);
        return () => {
            active = false;
            stopNativeSync?.();
        };
    }, [config]);

    if (!ready) return <Flex align="center" justify="center" h="100%"><Loader /></Flex>;

    return (
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
                <Notifications limit={5} />
                {props.children}
                <ReactQueryDevtools toggleButtonProps={{ style: { marginBottom: "2rem" } }} />
            </QueryClientProvider>
        </I18nextProvider>
    );
}

function TauriAppContent() {
    const { t } = useTranslation();
    const config = useContext(ConfigContext);
    const clientManager = useMemo(() => {
        const cm = new ClientManager(config);
        config.getOpenTabs().forEach((tab) => {
            cm.open(tab, config.values.app.toastNotifications, config.values.app.toastNotificationSound);
        });
        return cm;
    }, [config]);

    const tabsRef = useRef<ServerTabsRef>(null);

    const [currentServer, setCurrentServer] = useState<ServerConfig | undefined>(
        config.getServer(config.getLastOpenTab()));
    const [servers, setServers] = useState(config.getServers());

    const [showServerConfig, serverConfigHandlers] = useDisclosure(false);

    const [serverKey, incServerKey] = useReducer((x) => x + 1, 0);

    const onServerSave = useCallback((servers: ServerConfig[]) => {
        setServers(servers);
        config.setServers(servers);
        // force remount of server component to make sure interface settings are applied
        incServerKey();
        void config.save();
    }, [config]);

    const [showTabStrip, setShowTabStrip] = useState(config.values.app.showTabStrip);

    const toggleTabStrip = useCallback(() => {
        config.values.app.showTabStrip = !showTabStrip;
        setShowTabStrip(!showTabStrip);
    }, [config, showTabStrip]);

    const onCreateTorrent = useCallback(() => {
        void makeCreateTorrentView();
    }, []);

    return (
        <>
            <AppSettingsModal
                onSave={onServerSave}
                opened={showServerConfig}
                close={serverConfigHandlers.close}
            />
            <Flex direction="column" h="100%" w="100%">
                <ServerTabs
                    ref={tabsRef}
                    clientManager={clientManager}
                    servers={servers}
                    setCurrentServer={setCurrentServer}
                    visible={showTabStrip}
                >
                    <ShowVersion btn="lg" />
                    <ColorSchemeToggle btn="lg" />
                    <FontSizeToggle />
                    <CreateTorrentButton />
                    <ActionIcon
                        size="lg"
                        variant="default"
                        my="auto"
                        title={t("settings.configureServers")}
                        onClick={serverConfigHandlers.open}
                    >
                        <Icon.GearFill size="1.1rem" />
                    </ActionIcon>
                </ServerTabs>
                {currentServer !== undefined
                    ? <ServerConfigContext.Provider value={currentServer}>
                        <ClientContext.Provider value={clientManager.getClient(currentServer.name)}>
                            <Server
                                key={serverKey}
                                hostname={clientManager.getHostname(currentServer.name)}
                                tabsRef={tabsRef}
                                toolbarExtra={!showTabStrip && <>
                                    <ToolbarButton title={t("toolbar.createTorrentWithHotkey", { hotkey: modKeyString() })} onClick={onCreateTorrent}>
                                        <Icon.Stars size="1.5rem" />
                                    </ToolbarButton>
                                    <ToolbarButton title={t("settings.configureServers")} onClick={serverConfigHandlers.open}>
                                        <Icon.GearFill size="1.5rem" />
                                    </ToolbarButton>
                                    {tabsRef.current?.getOpenTabs() !== undefined && tabsRef.current?.getOpenTabs()?.length > 1
                                        && <Menu
                                            shadow="md"
                                            width="12rem"
                                            withinPortal
                                            returnFocus
                                            middlewares={{ shift: true, flip: true }}
                                        >
                                            <Menu.Target>
                                                <ToolbarButton title={t("modals.add.switchServer")}>
                                                    <Icon.Diagram2 size="1.5rem" />
                                                </ToolbarButton>
                                            </Menu.Target>

                                            <Menu.Dropdown>
                                                {tabsRef.current?.getOpenTabs().map((tab, index) =>
                                                    <Menu.Item key={index} onClick={() => { tabsRef.current?.switchTab(index); }}>
                                                        {tab}
                                                    </Menu.Item>)}
                                            </Menu.Dropdown>
                                        </Menu>}
                                </>}
                                toggleTabStrip={toggleTabStrip}
                            />
                        </ClientContext.Provider>
                    </ServerConfigContext.Provider>
                    : <Flex
                        justify="center"
                        align="center"
                        w="100%"
                        h="100%"
                    >
                        <Stack mih="20rem">
                            {servers.map((s, i) => {
                                return <Button
                                    key={i}
                                    variant="subtle"
                                    onClick={() => tabsRef.current?.openTab(s.name)}
                                >
                                    {s.name}
                                </Button>;
                            })}
                            <Box style={{ flexGrow: 1 }} />
                            <Button onClick={serverConfigHandlers.open}>
                                {t("settings.configureServers")}
                            </Button>
                        </Stack>
                    </Flex>}
            </Flex>
        </>
    );
}

export default function TauriApp() {
    return <App><TauriAppContent /></App>;
}
