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

import { ActionIcon, Button, Grid, Group, PasswordInput, SegmentedControl, Switch, Tabs, Text, Textarea, TextInput } from "@mantine/core";
import type { ServerConfig } from "config";
import { ConfigContext } from "config";
import cloneDeep from "lodash-es/cloneDeep";
import React, { useCallback, useContext, useEffect, useReducer, useState } from "react";
import { swapElements, useForceRender } from "util";
import type { ModalState } from "./common";
import { SaveCancelModal } from "./common";
import * as Icon from "react-bootstrap-icons";
import { invoke } from "@tauri-apps/api";

interface ServerListPanelProps {
    servers: string[],
    current: number,
    onSelect: (current: number) => void,
    onAdd: () => void,
    onRemove: () => void,
    onUp: () => void,
    onDown: () => void,
}

function ServerListPanel(props: ServerListPanelProps) {
    return (
        <div className="d-flex flex-column pe-3">
            <div className="border border-secondary flex-grow-1 mb-2" style={{ minHeight: "20rem" }}>
                {props.servers.map((s, i) => {
                    return <div key={i} className={("p-1 " + (i === props.current ? "selected" : ""))} onClick={() => { props.onSelect(i); }}>{s}</div>;
                })}
            </div>
            <Group position="apart" noWrap>
                <ActionIcon variant="light" onClick={props.onAdd}><Icon.PlusSquare size={24} color="royalblue" /></ActionIcon>
                <ActionIcon variant="light" onClick={props.onRemove}><Icon.DashSquare size={24} color="royalblue" /></ActionIcon>
                <ActionIcon variant="light" onClick={props.onUp}><Icon.ArrowUpSquare size={24} color="royalblue" /></ActionIcon>
                <ActionIcon variant="light" onClick={props.onDown}><Icon.ArrowDownSquare size={24} color="royalblue" /></ActionIcon>
            </Group>
        </div>
    );
}

interface ServerPanelProps {
    server: ServerConfig,
    onNameChange: (name: string) => void,
}

function ServerPanel(props: ServerPanelProps) {
    const forceRender = useForceRender();
    const [mappingsString, setMappingsString] = useState("");

    useEffect(() => {
        setMappingsString(props.server.pathMappings.map((m) => `${m.from}=${m.to}`).join("\n"));
    }, [props.server]);

    return (
        <div className="flex-grow-1">
            <TextInput
                label="Name"
                onChange={(e) => {
                    props.onNameChange(e.target.value);
                    forceRender();
                }}
                value={props.server.name}
            />

            <TextInput
                label="Server rpc url"
                onChange={(e) => {
                    props.server.connection.url = e.target.value;
                    forceRender();
                }}
                value={props.server.connection.url}
                placeholder="http://1.2.3.4:9091/transmission/rpc"
            />

            <Grid>
                <Grid.Col span={6}>
                    <TextInput
                        label="User name"
                        onChange={(e) => {
                            props.server.connection.username = e.target.value;
                            forceRender();
                        }}
                        value={props.server.connection.username}
                    />
                </Grid.Col>
                <Grid.Col span={6}>
                    <PasswordInput
                        label="Password"
                        onChange={(e) => {
                            props.server.connection.password = e.target.value;
                            forceRender();
                        }}
                        value={props.server.connection.password}
                    />
                </Grid.Col>

                <Grid.Col span={12}>
                    <Textarea
                        label={"Path mappings in \"remote=local\" format, one per line"}
                        onChange={(e) => {
                            const mappings = e.target.value.split("\n")
                                .filter((line) => line.includes("="))
                                .map((line) => {
                                    const equalsPos = line.indexOf("=");
                                    return { from: line.substring(0, equalsPos), to: line.substring(equalsPos + 1) };
                                });
                            props.server.pathMappings = mappings;
                            setMappingsString(e.target.value);
                        }}
                        value={mappingsString}
                        minRows={4}
                    />
                </Grid.Col>
            </Grid>
        </div>
    );
}

const bigSwitchStyles = { track: { flexGrow: 1 } };

const MinimizeOptions = ["minimize", "hide"];
const CloseOptions = ["hide", "close", "quit"];

function IntegrationsPanel() {
    const config = useContext(ConfigContext);

    const [deleteAdded, setDeleteAdded] = useReducer((_: boolean, newVal: boolean) => {
        config.values.app.deleteAdded = newVal;
        return newVal;
    }, config.values.app.deleteAdded);

    const [toastNotifications, setToastNotifications] = useReducer((_: boolean, newVal: boolean) => {
        config.values.app.toastNotifications = newVal;
        return newVal;
    }, config.values.app.toastNotifications);

    const [onMinimize, setOnMinimize] = useReducer((_: string, newVal: string) => {
        config.values.app.onMinimize = newVal;
        return newVal;
    }, config.values.app.onMinimize);

    const [onClose, setOnClose] = useReducer((_: string, newVal: string) => {
        config.values.app.onClose = newVal;
        return newVal;
    }, config.values.app.onClose);

    const [autostart, setAutostart] = useState(false);

    const associateTorrent = useCallback(() => {
        void invoke("app_integration", { mode: "torrent" });
    }, []);
    const associateMagnet = useCallback(() => {
        void invoke("app_integration", { mode: "magnet" });
    }, []);

    useEffect(() => {
        invoke("app_integration", { mode: "getautostart" })
            .then((result) => { setAutostart(result as boolean); })
            .catch(console.error);
    }, []);

    const onChangeAutostart = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const state = e.target.checked;
        setAutostart(state);
        void invoke("app_integration", { mode: state ? "autostart" : "noautostart" });
    }, []);

    return (
        <Grid align="center">
            <Grid.Col span={6}>Delete successfully added torrent files</Grid.Col>
            <Grid.Col span={2}>
                <Switch onLabel="ON" offLabel="OFF" size="xl" styles={bigSwitchStyles}
                    checked={deleteAdded} onChange={(e) => { setDeleteAdded(e.target.checked); }} />
            </Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>Show system notifications for completed torrents</Grid.Col>
            <Grid.Col span={2}>
                <Switch onLabel="ON" offLabel="OFF" size="xl" styles={bigSwitchStyles}
                    checked={toastNotifications} onChange={(e) => { setToastNotifications(e.target.checked); }} />
            </Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>Launch on startup</Grid.Col>
            <Grid.Col span={2}>
                <Switch onLabel="ON" offLabel="OFF" size="xl" styles={bigSwitchStyles}
                    checked={autostart} onChange={onChangeAutostart} />
            </Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>Associate with .torrent files</Grid.Col>
            <Grid.Col span={2}><Button onClick={associateTorrent}>Associate</Button></Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>Associate with magnet links</Grid.Col>
            <Grid.Col span={2}><Button onClick={associateMagnet}>Associate</Button></Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>When minimized</Grid.Col>
            <Grid.Col span={6}>
                <SegmentedControl data={MinimizeOptions} value={onMinimize} onChange={setOnMinimize} />
            </Grid.Col>
            <Grid.Col span={6}>When closed</Grid.Col>
            <Grid.Col span={6}>
                <SegmentedControl data={CloseOptions} value={onClose} onChange={setOnClose} />
            </Grid.Col>
            <Grid.Col>
                <Text fz="sm" fs="italic">
                    Hiding the window keeps frontend running, this uses more RAM but reopening the window is nearly instant.
                    Closing the window shuts down the webview, in this mode reopening the window is slower.
                    You can always access the window through the system tray icon.
                </Text>
            </Grid.Col>
        </Grid>
    );
}

interface AppSettingsModalProps extends ModalState {
    servers: ServerConfig[],
    onSave: (servers: ServerConfig[]) => void,
}

export function AppSettingsModal(props: AppSettingsModalProps) {
    const [servers, setServers] = useState(cloneDeep(props.servers));
    const [currentServerIndex, setCurrentServerIndex] = useState(0);

    useEffect(() => {
        setServers(cloneDeep(props.servers));
        if (currentServerIndex >= props.servers.length) {
            setCurrentServerIndex(props.servers.length > 0 ? props.servers.length - 1 : 0);
        }
    }, [props.servers, props.opened, currentServerIndex]);

    const onRenameCurrent = useCallback((name: string) => {
        servers[currentServerIndex] = { ...servers[currentServerIndex], name };
        setServers(servers.slice());
    }, [servers, currentServerIndex]);

    const onAdd = useCallback(() => {
        servers.push({
            connection: { url: "", username: "", password: "" },
            name: "new",
            pathMappings: [],
            expandedDirFilters: [],
            lastSaveDirs: [],
            intervals: { session: 60, torrents: 5, torrentsMinimized: 60, details: 5 },
        });
        setServers(servers.slice());
        setCurrentServerIndex(servers.length - 1);
    }, [servers]);

    const onRemove = useCallback(() => {
        if (currentServerIndex < servers.length) {
            servers.splice(currentServerIndex, 1);
            setServers(servers.slice());
            if (currentServerIndex === servers.length && currentServerIndex > 0) {
                setCurrentServerIndex(currentServerIndex - 1);
            }
        }
    }, [servers, currentServerIndex]);

    const onUp = useCallback(() => {
        if (currentServerIndex > 0) {
            swapElements(servers, currentServerIndex, currentServerIndex - 1);
            setServers(servers.slice());
            setCurrentServerIndex(currentServerIndex - 1);
        }
    }, [servers, currentServerIndex]);

    const onDown = useCallback(() => {
        if (currentServerIndex < servers.length - 1) {
            swapElements(servers, currentServerIndex, currentServerIndex + 1);
            setServers(servers.slice());
            setCurrentServerIndex(currentServerIndex + 1);
        }
    }, [servers, currentServerIndex]);

    const onSave = useCallback(() => {
        props.onSave(servers);
        props.close();
    }, [props, servers]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            centered
            title="Application Settings"
        >
            <Tabs mih="25rem" defaultValue="servers">
                <Tabs.List>
                    <Tabs.Tab value="servers" p="lg">Servers</Tabs.Tab>
                    <Tabs.Tab value="integrations" p="lg">Integrations</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="servers" pt="md">
                    <div className="d-flex w-100">
                        <ServerListPanel
                            servers={servers.map((s) => s.name)}
                            current={currentServerIndex}
                            onSelect={setCurrentServerIndex}
                            onAdd={onAdd}
                            onRemove={onRemove}
                            onUp={onUp}
                            onDown={onDown}
                        />
                        {currentServerIndex >= servers.length
                            ? <></>
                            : <ServerPanel server={servers[currentServerIndex]} onNameChange={onRenameCurrent} />}
                    </div>
                </Tabs.Panel>
                <Tabs.Panel value="integrations" pt="md">
                    <IntegrationsPanel />
                </Tabs.Panel>
            </Tabs>
        </SaveCancelModal>
    );
}
