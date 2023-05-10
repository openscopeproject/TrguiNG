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

import { ActionIcon, Grid, Group, PasswordInput, Textarea, TextInput } from "@mantine/core";
import { type ServerConfig } from "config";
import cloneDeep from "lodash-es/cloneDeep";
import React, { useCallback, useEffect, useState } from "react";
import { swapElements, useForceRender } from "util";
import { type ModalState, SaveCancelModal } from "./common";
import * as Icon from "react-bootstrap-icons";

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

interface ManageServerModalProps extends ModalState {
    servers: ServerConfig[],
    onSave: (servers: ServerConfig[]) => void,
}

export function ManageServersModal(props: ManageServerModalProps) {
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
        servers.push(
            {
                connection: { url: "", useAuth: false, username: "", password: "" },
                name: "new",
                pathMappings: [],
                expandedDirFilters: [],
                lastSaveDirs: [],
                intervals: { session: 60, torrents: 5, torrentsMinimized: 60, details: 5 },
            }
        );
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
            title="Edit Server Connections"
        >
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
        </SaveCancelModal>
    );
}
