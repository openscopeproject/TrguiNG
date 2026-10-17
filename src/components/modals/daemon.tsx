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

import type { NumberInputProps } from "@mantine/core";
import { Box, Button, Checkbox, Flex, Grid, Group, HoverCard, Loader, LoadingOverlay, NativeSelect, NumberInput, Tabs, Text, TextInput, Tooltip } from "@mantine/core";
import type { ServerConfig } from "config";
import { ConfigContext, ServerConfigContext } from "config";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ModalState } from "./common";
import { SaveCancelModal } from "./common";
import { queryClient, useMutateSession, useSessionFull, useTestPort, useUpdateBlocklist } from "queries";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import type { SessionInfo } from "rpc/client";
import type { ExtendedCustomColors } from "types/mantine";
import type { BandwidthGroup } from "rpc/torrent";
import { notifications } from "@mantine/notifications";
import type { InterfaceFormValues } from "./interfacepanel";
import { InterfaceSettigsPanel } from "./interfacepanel";
import * as Icon from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";
const { TAURI } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface FormValues extends InterfaceFormValues {
    intervals: ServerConfig["intervals"],
    session?: SessionInfo,
    bandwidthGroups?: BandwidthGroup[],
}

function PollingPanel({ form }: { form: UseFormReturnType<FormValues> }) {
    const { t } = useTranslation();
    return (
        <Grid align="center">
            <Grid.Col><Text>{t("modals.daemon.updateIntervals")}</Text></Grid.Col>
            <Grid.Col span={8}>{t("modals.daemon.session")}</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.session")}
                />
            </Grid.Col>
            <Grid.Col span={2} />
            <Grid.Col span={8}>{t("modals.daemon.torrentDetails")}</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.details")}
                />
            </Grid.Col>
            <Grid.Col span={2} />
            <Grid.Col span={8}>{t("modals.daemon.torrentsActive")}</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.torrents")}
                />
            </Grid.Col>
            <Grid.Col span={2} />
            <Grid.Col span={8}>{t("modals.daemon.torrentsInactive")}</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.torrentsMinimized")}
                />
            </Grid.Col>
            <Grid.Col span={2} />
        </Grid>
    );
}

function DownloadPanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    const { t } = useTranslation();
    return (
        <Grid align="center">
            <Grid.Col>
                <TextInput
                    label={t("modals.daemon.defaultDownloadFolder")}
                    {...form.getInputProps("session.download-dir")}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label={<Box>
                        <span>{t("modals.daemon.startAddedTorrents")}</span>
                        <HoverCard width={280} shadow="md">
                            <HoverCard.Target>
                                <Icon.Question />
                            </HoverCard.Target>
                            <HoverCard.Dropdown>
                                <Text size="sm">
                                    {t("modals.daemon.startAddedTorrentsHint")}
                                </Text>
                            </HoverCard.Dropdown>
                        </HoverCard>
                    </Box>}
                    {...form.getInputProps("session.start-added-torrents", { type: "checkbox" })}
                />
            </Grid.Col>
            {session["rpc-version"] as number >= 18
                && <Grid.Col>
                    <Checkbox
                        mt="lg"
                        label={t("modals.daemon.sequentialDownload")}
                        {...form.getInputProps("session.sequential_download", { type: "checkbox" })}
                    />
                </Grid.Col>}
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label={t("modals.daemon.renamePartialFiles")}
                    {...form.getInputProps("session.rename-partial-files", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label={t("modals.daemon.separateIncompleteDir")}
                    {...form.getInputProps("session.incomplete-dir-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col>
                <TextInput
                    label={t("modals.daemon.incompleteDir")}
                    {...form.getInputProps("session.incomplete-dir")}
                    disabled={session["incomplete-dir-enabled"] !== true}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label={t("modals.daemon.useDefaultSeedRatioLimit")}
                    {...form.getInputProps("session.seedRatioLimited", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    decimalScale={2}
                    fixedDecimalScale
                    step={0.05}
                    {...form.getInputProps("session.seedRatioLimit")}
                    disabled={session.seedRatioLimited !== true}
                />
            </Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label={t("modals.daemon.stopIdleTorrents")}
                    {...form.getInputProps("session.idle-seeding-limit-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.idle-seeding-limit")}
                    disabled={session["idle-seeding-limit-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={4}>{t("modals.daemon.minutes")}</Grid.Col>
            <Grid.Col span={6}>{t("modals.daemon.diskCacheSize")}</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.cache-size-mb")}
                />
            </Grid.Col>
            <Grid.Col span={4}>{t("modals.daemon.mb")}</Grid.Col>
        </Grid>
    );
}

interface PortTestResult {
    labelKey: string,
    color: ExtendedCustomColors,
}

function NetworkPanel(
    { opened, form, session }: {
        opened: boolean,
        form: UseFormReturnType<FormValues>,
        session: SessionInfo,
    },
) {
    const { t } = useTranslation();
    const [testPortQueryEnbaled, setTestPortQueryEnabled] = useState(false);
    const [testPortResult, setTestPortResult] = useState<PortTestResult>({ labelKey: "", color: "green" });

    const { data: testPort, status, fetchStatus, remove: removeQuery } = useTestPort(testPortQueryEnbaled);

    const onTestPort = useCallback(() => {
        setTestPortQueryEnabled(true);
    }, [setTestPortQueryEnabled]);

    useEffect(() => {
        if (fetchStatus !== "fetching") {
            setTestPortQueryEnabled(false);
        }
        if (status === "success") {
            setTestPortResult(testPort.arguments["port-is-open"] === true
                ? {
                    labelKey: "modals.daemon.portOpen",
                    color: "green",
                }
                : {
                    labelKey: "modals.daemon.portUnreachable",
                    color: "red",
                });
        } else if (status === "loading") {
            setTestPortResult({
                labelKey: "",
                color: "green",
            });
        } else {
            setTestPortResult({
                labelKey: "modals.daemon.apiError",
                color: "red",
            });
        }
    }, [fetchStatus, status, testPort]);

    useEffect(() => {
        if (!opened) {
            setTestPortResult({
                labelKey: "",
                color: "green",
            });
            removeQuery();
        }
    }, [opened, setTestPortResult, removeQuery]);

    const { mutate: updateBlocklist, isLoading: updatePending } = useUpdateBlocklist();
    const onUpdateBlocklist = useCallback(() => {
        updateBlocklist(undefined, {
            onError: (e) => {
                console.log(e);
                notifications.show({
                    title: t("modals.daemon.errorUpdatingBlocklist"),
                    message: e.message,
                    color: "red",
                });
            },
        });
    }, [updateBlocklist, t]);

    return (
        <Grid align="center">
            <Grid.Col span={3}>
                {t("modals.daemon.incomingPort")}
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={1}
                    max={65535}
                    {...form.getInputProps("session.peer-port")}
                    disabled={session["peer-port-random-on-start"] === true}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <Tooltip
                    withArrow
                    label={t("modals.daemon.testPortHint")}
                >
                    <Button
                        w="100%"
                        onClick={onTestPort}
                        title={t("modals.daemon.testPort")}
                    >
                        {t("modals.daemon.testPort")}
                    </Button>
                </Tooltip>
            </Grid.Col>
            <Grid.Col span={3}>
                {fetchStatus === "fetching"
                    ? <Loader key="pt" size="1.5rem" />
                    : <Text key="pt" color={testPortResult.color}>{testPortResult.labelKey === "" ? "" : t(testPortResult.labelKey)}</Text>}
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label={t("modals.daemon.randomPort")}
                    {...form.getInputProps("session.peer-port-random-on-start", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label={t("modals.daemon.upnp")}
                    {...form.getInputProps("session.port-forwarding-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                {t("modals.daemon.encryption")}
            </Grid.Col>
            <Grid.Col span={3}>
                <NativeSelect
                    data={["tolerated", "preferred", "required"].map((value) => ({ value, label: t(`modals.daemon.encryptionOptions.${value}`) }))}
                    {...form.getInputProps("session.encryption")}
                />
            </Grid.Col>
            <Grid.Col span={6}></Grid.Col>
            <Grid.Col span={3}>
                {t("modals.daemon.globalPeerLimit")}
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.peer-limit-global")}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                {t("modals.daemon.perTorrent")}
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.peer-limit-per-torrent")}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    mt="lg"
                    label={t("modals.daemon.pex")}
                    {...form.getInputProps("session.pex-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    mt="lg"
                    label={t("modals.daemon.dht")}
                    {...form.getInputProps("session.dht-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    my="lg"
                    label={t("modals.daemon.lpd")}
                    {...form.getInputProps("session.lpd-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    my="lg"
                    label={t("modals.daemon.utp")}
                    {...form.getInputProps("session.utp-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label={t("modals.daemon.blocklist")}
                    {...form.getInputProps("session.blocklist-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <TextInput
                    {...form.getInputProps("session.blocklist-url")}
                    disabled={session["blocklist-enabled"] !== true}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Text>
                    {t("modals.daemon.blocklistEntries", { count: session["blocklist-size"] as number })}
                </Text>
            </Grid.Col>
            <Grid.Col span={3}>
                <Tooltip
                    withArrow
                    label={t("modals.daemon.updateBlocklistHint")}
                >
                    <Button
                        w="100%"
                        onClick={onUpdateBlocklist}
                        title={t("modals.daemon.updateBlocklist")}
                    >
                        {t("modals.daemon.update")}
                    </Button>
                </Tooltip>
            </Grid.Col>
            <Grid.Col span={3}>
                {updatePending && <Loader size="1.5rem" />}
            </Grid.Col>
        </Grid>
    );
}

function TimeInput({ value, onChange, ...rest }: NumberInputProps) {
    const [hours, minutes] = useMemo(() => {
        const intVal = Number(value);
        return [Math.floor(intVal / 60), intVal % 60];
    }, [value]);

    const onHoursChange = useCallback((v: number | string) => {
        const h = Number(v);
        onChange?.(60 * h + minutes);
    }, [minutes, onChange]);
    const onMinutesChange = useCallback((v: number | string) => {
        const m = Number(v);
        onChange?.(60 * hours + m);
    }, [hours, onChange]);

    return (
        <div style={{ display: "flex" }}>
            <NumberInput
                min={0}
                max={23}
                step={1}
                value={hours}
                onChange={onHoursChange}
                {...rest}
            />
            <NumberInput
                min={0}
                max={59}
                step={1}
                value={minutes}
                onChange={onMinutesChange}
                {...rest}
            />
        </div>
    );
}

const DaysOfTheWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function DayOfWeekCheckbox({ form, day, session }: { form: UseFormReturnType<FormValues>, day: number, session: SessionInfo }) {
    const { t } = useTranslation();
    return <Checkbox
        my="lg"
        label={t(`modals.daemon.days.${DaysOfTheWeek[day].toLowerCase()}`)}
        checked={((session["alt-speed-time-day"] as number) & (1 << day)) > 0}
        onChange={(event) => {
            const val = session["alt-speed-time-day"] as number;
            form.setFieldValue(
                "session.alt-speed-time-day",
                event.currentTarget.checked ? val | (1 << day) : val & ~(1 << day));
        }}
        disabled={session["alt-speed-time-enabled"] !== true}
    />;
}

function BandwidthPanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    const { t } = useTranslation();
    return (
        <Grid align="center">
            <Grid.Col span={6}></Grid.Col>
            <Grid.Col span={3}>{t("modals.daemon.normal")}</Grid.Col>
            <Grid.Col span={3}>{t("modals.daemon.alternate")}</Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label={t("modals.daemon.maxDownloadSpeed")}
                    {...form.getInputProps("session.speed-limit-down-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.speed-limit-down")}
                    disabled={session["speed-limit-down-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.alt-speed-down")}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label={t("modals.daemon.maxUploadSpeed")}
                    {...form.getInputProps("session.speed-limit-up-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.speed-limit-up")}
                    disabled={session["speed-limit-up-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.alt-speed-up")}
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    mt="lg"
                    label={t("modals.daemon.useAltSpeed")}
                    {...form.getInputProps("session.alt-speed-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    my="lg"
                    label={t("modals.daemon.autoAltSpeed")}
                    {...form.getInputProps("session.alt-speed-time-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>{t("modals.daemon.from")}</Grid.Col>
            <Grid.Col span={3}>
                <TimeInput
                    {...form.getInputProps("session.alt-speed-time-begin")}
                    disabled={session["alt-speed-time-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={1}>{t("modals.daemon.to")}</Grid.Col>
            <Grid.Col span={3}>
                <TimeInput
                    {...form.getInputProps("session.alt-speed-time-end")}
                    disabled={session["alt-speed-time-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={3}></Grid.Col>
            <Grid.Col span={2}>{t("modals.daemon.daysLabel")}</Grid.Col>
            <Grid.Col span={10}>
                <Group>
                    {DaysOfTheWeek.map((_, day) =>
                        (<DayOfWeekCheckbox
                            key={day}
                            form={form}
                            day={day}
                            session={session}
                        />))}
                </Group>
            </Grid.Col>
        </Grid>
    );
}

function QueuePanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    const { t } = useTranslation();
    return (
        <Grid align="center">
            <Grid.Col span={8}>
                <Checkbox
                    label={t("modals.daemon.downloadQueueSize")}
                    {...form.getInputProps("session.download-queue-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.download-queue-size")}
                    disabled={session["download-queue-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={8}>
                <Checkbox
                    label={t("modals.daemon.seedQueueSize")}
                    {...form.getInputProps("session.seed-queue-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.seed-queue-size")}
                    disabled={session["seed-queue-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={8}>
                <Checkbox
                    label={t("modals.daemon.queueStalled")}
                    {...form.getInputProps("session.queue-stalled-enabled", { type: "checkbox" })}
                />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.queue-stalled-minutes")}
                    disabled={session["queue-stalled-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={2}>{t("modals.daemon.minutes")}</Grid.Col>
        </Grid>
    );
}

function MagnetHandlerPanel() {
    const { t } = useTranslation();
    const handlerUrl = useMemo(() => {
        const handlerUrl = new URL(window.location.href);
        handlerUrl.search = "add=%s";
        return handlerUrl;
    }, []);

    const registerHandler = useCallback(() => {
        navigator.registerProtocolHandler("magnet", handlerUrl.toString());
    }, [handlerUrl]);

    // Unregister handler only exists in some browsers
    const unregisterHandler = useCallback(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).unregisterProtocolHandler?.("magnet", handlerUrl.toString());
    }, [handlerUrl]);

    return (
        <Grid align="center">
            {window.location.protocol === "https:"
                ? <>
                    <Grid.Col span={6}>
                        <Text>{t("modals.daemon.registerMagnet")}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                        <Flex justify="space-around">
                            <Button onClick={registerHandler}>{t("modals.daemon.register")}</Button>
                            {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                typeof (navigator as any).unregisterProtocolHandler === "function"
                                && <Button onClick={unregisterHandler}>{t("modals.daemon.unregister")}</Button>
                            }
                        </Flex>
                    </Grid.Col>
                </>
                : <Grid.Col>
                    <Text mb="md">
                        {t("modals.daemon.registerMagnetUnavailable")}
                    </Text>
                    <Text>
                        {t("modals.daemon.httpsHint")}
                    </Text>
                </Grid.Col>}
        </Grid>
    );
}

export function DaemonSettingsModal(props: ModalState) {
    const { t } = useTranslation();
    const { data: session, fetchStatus } = useSessionFull(props.opened);
    const mutation = useMutateSession();
    const config = useContext(ConfigContext);
    const serverConfig = useContext(ServerConfigContext);

    const form = useForm<FormValues>({
        initialValues: {
            intervals: serverConfig.intervals,
            session,
            interface: config.values.interface,
        },
    });

    const { setFieldValue } = form;
    useEffect(() => {
        setFieldValue("session", session);
    }, [session, setFieldValue]);

    useEffect(() => {
        if (props.opened) {
            setFieldValue("interface", config.values.interface);
        }
    }, [config, props.opened, setFieldValue]);

    const onSave = useCallback(() => {
        serverConfig.intervals = { ...form.values.intervals };
        config.values.interface = { ...config.values.interface, ...form.values.interface };
        config.cleanup();
        void config.save();
        if (form.values.session !== undefined) {
            mutation.mutate(form.values.session, {
                onSuccess: () => {
                    notifications.show({
                        message: t("modals.daemon.sessionSaved"),
                        color: "green",
                    });
                    props.close();
                    if (!TAURI) {
                        // clear client cache to make sure new interface settings are applied
                        queryClient.clear();
                    }
                },
                onError: (error) => {
                    notifications.show({
                        title: t("modals.daemon.failedToUpdateSettings"),
                        message: String(error),
                        color: "red",
                    });
                },
            });
        } else {
            props.close();
        }
    }, [form.values, mutation, props, config, serverConfig, t]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            saveLoading={mutation.isLoading}
            centered
            title={t("modals.daemon.serverSettings")}
        >
            <Box pos="relative">
                <LoadingOverlay visible={fetchStatus === "fetching"} overlayProps={{ blur: 2 }} />
                <Tabs defaultValue="polling" mih="33rem">
                    <Tabs.List>
                        <Tabs.Tab value="polling" p="lg">{t("modals.daemon.tabs.polling")}</Tabs.Tab>
                        <Tabs.Tab value="download" p="lg">{t("modals.daemon.tabs.download")}</Tabs.Tab>
                        <Tabs.Tab value="network" p="lg">{t("modals.daemon.tabs.network")}</Tabs.Tab>
                        <Tabs.Tab value="bandwidth" p="lg">{t("modals.daemon.tabs.bandwidth")}</Tabs.Tab>
                        <Tabs.Tab value="queue" p="lg">{t("modals.daemon.tabs.queue")}</Tabs.Tab>
                        {!TAURI && <>
                            <Tabs.Tab value="interface" p="lg">{t("modals.daemon.tabs.interface")}</Tabs.Tab>
                            <Tabs.Tab value="magnethandler" p="lg">{t("modals.daemon.tabs.magnetLinks")}</Tabs.Tab>
                        </>}
                    </Tabs.List>
                    {form.values.session !== undefined
                        ? <>
                            <Tabs.Panel value="polling" p="lg">
                                <PollingPanel form={form} />
                            </Tabs.Panel>

                            <Tabs.Panel value="download" p="lg">
                                <DownloadPanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="network" p="lg">
                                <NetworkPanel opened={props.opened} form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="bandwidth" p="lg">
                                <BandwidthPanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="queue" p="lg">
                                <QueuePanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            {!TAURI && <>
                                <Tabs.Panel value="interface" p="lg">
                                    <InterfaceSettigsPanel form={form} />
                                </Tabs.Panel>
                                <Tabs.Panel value="magnethandler" p="lg">
                                    <MagnetHandlerPanel />
                                </Tabs.Panel>
                            </>}
                        </>
                        : <></>}
                </Tabs>
            </Box>
        </SaveCancelModal>
    );
}
