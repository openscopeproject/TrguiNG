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

import {
    ActionIcon, Box, Button, Checkbox, Flex, Grid, Group, PasswordInput, SegmentedControl,
    Stack, Switch, Tabs, Text, Textarea, TextInput,
} from "@mantine/core";
import classes from "./settings.module.css";
import clsx from "clsx";
import type { ServerConfig, WindowCloseOption, WindowMinimizeOption } from "config";
import { ConfigContext, WindowCloseOptions, WindowMinimizeOptions } from "config";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ModalState } from "./common";
import { SaveCancelModal } from "./common";
import * as Icon from "react-bootstrap-icons";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import { UAParser } from "ua-parser-js";
import type { InterfaceFormValues } from "./interfacepanel";
import { InterfaceSettigsPanel } from "./interfacepanel";
import { useTranslation } from "react-i18next";
const { TAURI, invoke } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface FormValues extends InterfaceFormValues {
    servers: ServerConfig[],
    app: {
        deleteAdded: boolean,
        toastNotifications: boolean,
        toastNotificationSound: boolean,
        showTrayIcon: boolean,
        onMinimize: WindowMinimizeOption,
        onClose: WindowCloseOption,
    },
}

interface ServerListPanelProps {
    form: UseFormReturnType<FormValues>,
    current: number,
    setCurrent: React.Dispatch<number>,
}

function ServerListPanel({ form, current, setCurrent }: ServerListPanelProps) {
    const { t } = useTranslation();
    return (
        <Stack>
            <Box mb="md" className={clsx("scrollable", classes.serverListContainer)}>
                <div>
                    {form.values.servers.map((s, i) => {
                        let isDuplicate = false;
                        form.values.servers.forEach((other, otherIndex) => {
                            if (otherIndex !== i && other.name === s.name) isDuplicate = true;
                        });
                        return <Box
                            key={i}
                            px="sm"
                            className={i === current ? "selected" : ""}
                            style={{ textDecoration: isDuplicate ? "red wavy underline" : undefined }}
                            onClick={() => { setCurrent(i); }}
                        >
                            {s.name}
                        </Box>;
                    })}
                </div>
            </Box>
            <Group justify="space-between" wrap="nowrap">
                <ActionIcon
                    variant="light"
                    title={t("settings.addServer")}
                    aria-label={t("settings.addServer")}
                    onClick={() => {
                        form.insertListItem("servers", {
                            connection: { url: "", username: "", password: "", acceptInvalidCerts: false },
                            name: t("settings.newServer"),
                            pathMappings: [],
                            expandedDirFilters: [],
                            lastSaveDirs: [],
                            intervals: { session: 60, torrents: 5, torrentsMinimized: 60, details: 5 },
                        });
                        form.validate();
                        setCurrent(form.values.servers.length);
                    }}
                >
                    <Icon.PlusSquare size="1.6rem" color="royalblue" />
                </ActionIcon>
                <ActionIcon
                    variant="light"
                    title={t("settings.removeServer")}
                    aria-label={t("settings.removeServer")}
                    onClick={() => {
                        if (current >= form.values.servers.length - 1) {
                            setCurrent(form.values.servers.length - 2);
                        }
                        form.removeListItem("servers", current);
                    }}
                >
                    <Icon.DashSquare size="1.6rem" color="royalblue" />
                </ActionIcon>
                <ActionIcon
                    variant="light"
                    title={t("settings.moveServerUp")}
                    aria-label={t("settings.moveServerUp")}
                    onClick={() => {
                        if (current > 0) {
                            form.reorderListItem("servers", { from: current, to: current - 1 });
                            setCurrent(current - 1);
                        }
                    }}
                >
                    <Icon.ArrowUpSquare size="1.6rem" color="royalblue" />
                </ActionIcon>
                <ActionIcon
                    variant="light"
                    title={t("settings.moveServerDown")}
                    aria-label={t("settings.moveServerDown")}
                    onClick={() => {
                        if (current < form.values.servers.length - 1) {
                            form.reorderListItem("servers", { from: current, to: current + 1 });
                            setCurrent(current + 1);
                        }
                    }}
                >
                    <Icon.ArrowDownSquare size="1.6rem" color="royalblue" />
                </ActionIcon>
            </Group>
        </Stack>
    );
}

interface ServerPanelProps {
    form: UseFormReturnType<FormValues>,
    current: number,
}

function ServerPanel(props: ServerPanelProps) {
    const { t } = useTranslation();
    const localizeError = (error: React.ReactNode) => typeof error === "string" ? t(error) : error;
    const [mappingsString, setMappingsString] = useState("");
    const server = props.form.values.servers[props.current];

    useEffect(() => {
        setMappingsString(server.pathMappings.map((m) => `${m.from}=${m.to}`).join("\n"));
    }, [server.pathMappings]);

    return (
        <div style={{ flexGrow: 1 }}>
            <TextInput
                label={t("settings.name")}
                {...props.form.getInputProps(`servers.${props.current}.name`)}
                error={localizeError(props.form.errors[`servers.${props.current}.name`])}
                autoCorrect="off"
                autoCapitalize="off"
            />

            <TextInput
                label={t("settings.rpcUrl")}
                {...props.form.getInputProps(`servers.${props.current}.connection.url`)}
                error={localizeError(props.form.errors[`servers.${props.current}.connection.url`])}
                placeholder="http://1.2.3.4:9091/transmission/rpc"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
            />

            <Checkbox
                my="md"
                label={t("settings.acceptInvalidCerts")}
                {...props.form.getInputProps(`servers.${props.current}.connection.acceptInvalidCerts`, { type: "checkbox" })}
            />

            <Grid>
                <Grid.Col span={6}>
                    <TextInput
                        label={t("settings.username")}
                        {...props.form.getInputProps(`servers.${props.current}.connection.username`)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                    />
                </Grid.Col>
                <Grid.Col span={6}>
                    <PasswordInput
                        label={t("settings.password")}
                        {...props.form.getInputProps(`servers.${props.current}.connection.password`)}
                    />
                </Grid.Col>

                <Grid.Col span={12}>
                    <Textarea
                        label={t("settings.pathMappings")}
                        onChange={(e) => {
                            // TODO fix
                            const mappings = e.target.value.split("\n")
                                .map((line) => {
                                    const equalsPos = line.indexOf("=") + 1;
                                    return {
                                        from: line.substring(0, equalsPos - 1),
                                        to: line.substring(equalsPos),
                                    };
                                });
                            props.form.setFieldValue(`servers.${props.current}.pathMappings`, mappings);
                            setMappingsString(e.target.value);
                        }}
                        value={mappingsString}
                        autosize
                        minRows={8}
                        maxRows={8}
                    />
                </Grid.Col>
            </Grid>
        </div>
    );
}

const bigSwitchStyles = { track: { flexGrow: 1 } };

function IntegrationsPanel({ form }: { form: UseFormReturnType<FormValues> }) {
    const { t } = useTranslation();
    const platform = useMemo(() => UAParser().os.name ?? "unknown", []);

    const [autostart, setAutostart] = useState(false);

    const associateTorrent = useCallback(() => {
        void invoke("app_integration", { mode: "torrent" });
    }, []);
    const associateMagnet = useCallback(() => {
        void invoke("app_integration", { mode: "magnet" });
    }, []);

    useEffect(() => {
        if (platform === "Windows") {
            invoke("app_integration", { mode: "getautostart" })
                .then((result) => { setAutostart(result as boolean); })
                .catch(console.error);
        }
    }, [platform]);

    const onChangeAutostart = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const state = e.target.checked;
        setAutostart(state);
        void invoke("app_integration", { mode: state ? "autostart" : "noautostart" });
    }, []);

    return (
        <Grid align="center" gutter="md">
            <Grid.Col span={6}>{t("settings.deleteAdded")}</Grid.Col>
            <Grid.Col span={2}>
                <Switch
                    onLabel={t("settings.on")}
                    offLabel={t("settings.off")}
                    size="xl"
                    styles={bigSwitchStyles}
                    {...form.getInputProps("app.deleteAdded", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>{t("settings.showNotifications")}</Grid.Col>
            <Grid.Col span={2}>
                <Switch
                    onLabel={t("settings.on")}
                    offLabel={t("settings.off")}
                    size="xl"
                    styles={bigSwitchStyles}
                    {...form.getInputProps("app.toastNotifications", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>{t("settings.playSound")}</Grid.Col>
            <Grid.Col span={2}>
                <Switch
                    onLabel={t("settings.on")}
                    offLabel={t("settings.off")}
                    size="xl"
                    styles={bigSwitchStyles}
                    {...form.getInputProps("app.toastNotificationSound", { type: "checkbox" })}
                />
            </Grid.Col>
            {platform === "Windows" && <>
                <Grid.Col span={6}>{t("settings.launchOnStartup")}</Grid.Col>
                <Grid.Col span={2}>
                    <Switch
                        onLabel={t("settings.on")}
                        offLabel={t("settings.off")}
                        size="xl"
                        styles={bigSwitchStyles}
                        checked={autostart}
                        onChange={onChangeAutostart}
                    />
                </Grid.Col>
                <Grid.Col span={4}></Grid.Col>
                <Grid.Col span={6}>{t("settings.associateApp")}</Grid.Col>
                <Grid.Col span={3}><Button onClick={associateTorrent}>{t("settings.torrentFiles")}</Button></Grid.Col>
                <Grid.Col span={3}><Button onClick={associateMagnet}>{t("settings.magnetLinks")}</Button></Grid.Col>
            </>}
            <Grid.Col span={6}>{t("settings.showTrayIcon")}</Grid.Col>
            <Grid.Col span={2}>
                <Switch
                    onLabel={t("settings.on")}
                    offLabel={t("settings.off")}
                    size="xl"
                    styles={bigSwitchStyles}
                    checked={form.values.app.showTrayIcon}
                    onChange={(e) => {
                        form.setFieldValue("app.showTrayIcon", e.currentTarget.checked);
                        if (!e.currentTarget.checked) {
                            form.setFieldValue("app.onMinimize", "minimize");
                            form.setFieldValue("app.onClose", "quit");
                        }
                    }}
                />
            </Grid.Col>
            <Grid.Col span={4}>{t("settings.restartRequired")}</Grid.Col>
            <Grid.Col span={6}>{t("settings.whenMinimized")}</Grid.Col>
            <Grid.Col span={6}>
                <SegmentedControl
                    data={WindowMinimizeOptions.map((value) => ({ value, label: t(`interface.options.${value}`) }))}
                    disabled={!form.values.app.showTrayIcon}
                    {...form.getInputProps("app.onMinimize")}
                />
            </Grid.Col>
            <Grid.Col span={6}>{t("settings.whenClosed")}</Grid.Col>
            <Grid.Col span={6}>
                <SegmentedControl
                    data={WindowCloseOptions.map((value) => ({ value, label: t(`interface.options.${value}`) }))}
                    disabled={!form.values.app.showTrayIcon}
                    {...form.getInputProps("app.onClose")}
                />
            </Grid.Col>
            <Grid.Col>
                <Text fz="sm" fs="italic">
                    {t("settings.trayHint")}
                </Text>
            </Grid.Col>
        </Grid>
    );
}

interface AppSettingsModalProps extends ModalState {
    onSave: (servers: ServerConfig[]) => void,
}

export function AppSettingsModal(props: AppSettingsModalProps) {
    const { t } = useTranslation();
    const config = useContext(ConfigContext);
    const form = useForm<FormValues>({
        initialValues: {
            servers: config.getServers(),
            app: { ...config.values.app },
            interface: { ...config.values.interface },
        },
        validate: {
            servers: {
                name: (value, values, path) => {
                    let found = false;
                    values.servers.forEach((server, i) => {
                        if (`servers.${i}.name` !== path && value === server.name) {
                            found = true;
                        }
                    });
                    return found ? "settings.serverNamesUnique" : null;
                },
                connection: {
                    url: (value) => {
                        try {
                            const url = new URL(value);
                            if (!["http:", "https:"].includes(url.protocol)) {
                                return "settings.onlyHttp";
                            }
                        } catch {
                            return "settings.invalidUrl";
                        }
                        return null;
                    },
                },
            },
        },
        validateInputOnChange: true,
    });

    const [currentServerIndex, setCurrentServerIndex] = useState(-1);
    const { setValues } = form;

    useEffect(() => {
        if (props.opened) {
            setValues({
                servers: config.getServers(),
                app: { ...config.values.app },
                interface: { ...config.values.interface },
            });
            setCurrentServerIndex(config.getServers().length > 0 ? 0 : -1);
        }
    }, [config, props.opened, setValues]);

    const onSave = useCallback(() => {
        form.validate();
        if (form.isValid()) {
            config.setServers(form.values.servers);
            config.values.app = { ...config.values.app, ...form.values.app, language: config.values.app.language };
            config.values.interface = { ...config.values.interface, ...form.values.interface };
            config.cleanup();
            props.onSave(form.values.servers);
            props.close();
        }
    }, [config, form, props]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            centered
            title={t("settings.title")}
        >
            <form>
                <Tabs mih="33rem" defaultValue="servers">
                    <Tabs.List>
                        <Tabs.Tab value="servers" p="lg">{t("settings.tabs.servers")}</Tabs.Tab>
                        <Tabs.Tab value="integrations" p="lg">{t("settings.tabs.integrations")}</Tabs.Tab>
                        {TAURI && <Tabs.Tab value="interface" p="lg">{t("settings.tabs.interface")}</Tabs.Tab>}
                    </Tabs.List>

                    <Tabs.Panel value="servers" pt="md">
                        <Flex h="100%" gap="0.5rem" mih="28rem">
                            <ServerListPanel form={form} current={currentServerIndex} setCurrent={setCurrentServerIndex} />
                            {currentServerIndex === -1
                                ? <></>
                                : <ServerPanel form={form} current={currentServerIndex} />}
                        </Flex>
                    </Tabs.Panel>

                    <Tabs.Panel value="integrations" pt="md">
                        <IntegrationsPanel form={form} />
                    </Tabs.Panel>

                    {TAURI && <Tabs.Panel value="interface" pt="md">
                        <InterfaceSettigsPanel form={form} />
                    </Tabs.Panel>}
                </Tabs>
            </form>
        </SaveCancelModal>
    );
}
