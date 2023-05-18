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

import type { NumberInputProps } from "@mantine/core";
import { Box, Button, Checkbox, Grid, Group, Loader, LoadingOverlay, NativeSelect, NumberInput, Tabs, Text, TextInput } from "@mantine/core";
import type { ServerConfig } from "config";
import { ServerConfigContext } from "config";
import React, { useCallback, useContext, useEffect, useState } from "react";
import type { ModalState } from "./common";
import { SaveCancelModal } from "./common";
import { useMutateSession, useSessionFull, useTestPort } from "queries";
import type { UseFormReturnType } from "@mantine/form";
import { useForm } from "@mantine/form";
import type { SessionInfo } from "rpc/client";
import type { ExtendedCustomColors } from "types/mantine";
import type { BandwidthGroup } from "rpc/torrent";
import { notifications } from "@mantine/notifications";

interface FormValues {
    intervals: ServerConfig["intervals"],
    session?: SessionInfo,
    bandwidthGroups?: BandwidthGroup[],
}

function PollingPanel({ form }: { form: UseFormReturnType<FormValues> }) {
    return (
        <Grid align="center">
            <Grid.Col span={12}><Text>Update intervals (sec)</Text></Grid.Col>
            <Grid.Col span={4}>Session</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.session")}
                />
            </Grid.Col>
            <Grid.Col span={4}>Torrent details</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.details")}
                />
            </Grid.Col>
            <Grid.Col span={4}>Torrents</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.torrents")}
                />
            </Grid.Col>
            <Grid.Col span={4}>Torrents minimized</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={3600}
                    {...form.getInputProps("intervals.torrentsMinimized")}
                />
            </Grid.Col>
        </Grid>
    );
}

function DownloadPanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    return (
        <Grid align="center">
            <Grid.Col>
                <TextInput
                    label="Default download folder (server setting)"
                    {...form.getInputProps("session.download-dir")} />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    label="Add .part extension to incomplete files"
                    {...form.getInputProps("session.rename-partial-files", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    label="Use separate directory for incomplete files"
                    {...form.getInputProps("session.incomplete-dir-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col>
                <TextInput
                    label="Path for incomplete files"
                    {...form.getInputProps("session.incomplete-dir")}
                    disabled={session["incomplete-dir-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Use default seed ratio limit"
                    {...form.getInputProps("session.seedRatioLimited", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    precision={2}
                    step={0.05}
                    {...form.getInputProps("session.seedRatioLimit")}
                    disabled={session.seedRatioLimited !== true}
                />
            </Grid.Col>
            <Grid.Col span={4}></Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Stop idle torrents after"
                    {...form.getInputProps("session.idle-seeding-limit-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.idle-seeding-limit")}
                    disabled={session["idle-seeding-limit-enabled"] !== true}
                />
            </Grid.Col>
            <Grid.Col span={4}>minutes</Grid.Col>
            <Grid.Col span={6}>Disk cache size</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.cache-size-mb")}
                />
            </Grid.Col>
            <Grid.Col span={4}>MB</Grid.Col>
        </Grid>
    );
}

interface PortTestResult {
    label: string,
    color: ExtendedCustomColors,
}

function NetworkPanel(
    { opened, form, session }: {
        opened: boolean,
        form: UseFormReturnType<FormValues>,
        session: SessionInfo,
    }
) {
    const [testPortQueryEnbaled, setTestPortQueryEnabled] = useState(false);
    const [testPortResult, setTestPortResult] = useState<PortTestResult>({ label: "", color: "green" });

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
                    label: "Port is open",
                    color: "green",
                }
                : {
                    label: "Port unreachable",
                    color: "red",
                });
        } else if (status === "loading") {
            setTestPortResult({
                label: "",
                color: "green",
            });
        } else {
            setTestPortResult({
                label: "API error",
                color: "red",
            });
        }
    }, [fetchStatus, status, testPort]);

    useEffect(() => {
        if (!opened) {
            setTestPortResult({
                label: "",
                color: "green"
            });
            removeQuery();
        }
    }, [opened, setTestPortResult, removeQuery]);

    return (
        <Grid align="center">
            <Grid.Col span={3}>
                Incoming port:
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
                <Button
                    w="100%"
                    onClick={onTestPort}
                    title="Save port changes before testing"
                >
                    Test port
                </Button>
            </Grid.Col>
            <Grid.Col span={3}>
                {fetchStatus === "fetching"
                    ? <Loader key="pt" size="1.5rem" />
                    : <Text key="pt" color={testPortResult.color}>{testPortResult.label}</Text>
                }
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Let daemon pick a random port"
                    {...form.getInputProps("session.peer-port-random-on-start", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Enable UPnP port forwarding"
                    {...form.getInputProps("session.port-forwarding-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={3}>
                Encryption:
            </Grid.Col>
            <Grid.Col span={3}>
                <NativeSelect
                    data={["tolerated", "preferred", "required"]}
                    {...form.getInputProps("session.encryption")} />
            </Grid.Col>
            <Grid.Col span={6}></Grid.Col>
            <Grid.Col span={3}>
                Global peer limit:
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.peer-limit-global")}
                />
            </Grid.Col>
            <Grid.Col span={3}>
                per torrent:
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.peer-limit-per-torrent")}
                />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Enable peer exchange"
                    {...form.getInputProps("session.pex-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Enable DHT"
                    {...form.getInputProps("session.dht-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Enable local discovery"
                    {...form.getInputProps("session.lpd-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Enable uTP"
                    {...form.getInputProps("session.utp-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Enable blocklist:"
                    {...form.getInputProps("session.blocklist-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={6}>
                <TextInput
                    {...form.getInputProps("session.blocklist-url")}
                    disabled={session["blocklist-enabled"] !== true} />
            </Grid.Col>
        </Grid>
    );
}

function toTimeStr(time: string) {
    const t = parseInt(time);
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}

function fromTimeStr(time: string) {
    const parts = time.split(":");
    if (parts.length !== 2) return "";
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    if (isNaN(h) || isNaN(m)) return "";
    return `${h * 60 + m}`;
}

function TimeInput(props: NumberInputProps) {
    return <NumberInput
        {...props}
        parser={fromTimeStr}
        formatter={toTimeStr}
    />;
}

const DaysOfTheWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function DayOfWeekCheckbox({ form, day, session }: { form: UseFormReturnType<FormValues>, day: number, session: SessionInfo }) {
    return <Checkbox
        label={DaysOfTheWeek[day]}
        checked={(session["alt-speed-time-day"] & (1 << day)) > 0}
        onChange={(event) => {
            const val = session["alt-speed-time-day"];
            form.setFieldValue(
                "session.alt-speed-time-day",
                event.currentTarget.checked ? val | (1 << day) : val & ~(1 << day));
        }}
        disabled={session["alt-speed-time-enabled"] !== true} />;
}

function BandwidthPanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    return (
        <Grid align="center">
            <Grid.Col span={6}></Grid.Col>
            <Grid.Col span={3}>Normal</Grid.Col>
            <Grid.Col span={3}>Alternate</Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Maximum download speed (KB/s):"
                    {...form.getInputProps("session.speed-limit-down-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.speed-limit-down")}
                    disabled={session["speed-limit-down-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.alt-speed-down")} />
            </Grid.Col>
            <Grid.Col span={6}>
                <Checkbox
                    label="Maximum upload speed (KB/s):"
                    {...form.getInputProps("session.speed-limit-up-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.speed-limit-up")}
                    disabled={session["speed-limit-up-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={3}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.alt-speed-up")} />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    label="Use alternate bandwidth settings"
                    {...form.getInputProps("session.alt-speed-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col>
                <Checkbox
                    label="Apply alternate bandwidth settings automatically"
                    {...form.getInputProps("session.alt-speed-time-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>From:</Grid.Col>
            <Grid.Col span={3}>
                <TimeInput
                    min={0}
                    max={24 * 60 - 1}
                    {...form.getInputProps("session.alt-speed-time-begin")}
                    disabled={session["alt-speed-time-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={2}>to:</Grid.Col>
            <Grid.Col span={3}>
                <TimeInput
                    min={0}
                    max={24 * 60 - 1}
                    {...form.getInputProps("session.alt-speed-time-end")}
                    disabled={session["alt-speed-time-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={2}>Days:</Grid.Col>
            <Grid.Col span={10}>
                <Group>
                    {DaysOfTheWeek.map((_, day) =>
                        <DayOfWeekCheckbox key={day} form={form} day={day} session={session} />
                    )}
                </Group>
            </Grid.Col>
        </Grid>
    );
}

function QueuePanel({ form, session }: { form: UseFormReturnType<FormValues>, session: SessionInfo }) {
    return (
        <Grid align="center">
            <Grid.Col span={8}>
                <Checkbox
                    label="Download queue size"
                    {...form.getInputProps("session.download-queue-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.download-queue-size")}
                    disabled={session["download-queue-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={8}>
                <Checkbox
                    label="Seed queue size"
                    {...form.getInputProps("session.seed-queue-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.seed-queue-size")}
                    disabled={session["seed-queue-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col span={8}>
                <Checkbox
                    label="Consider torrents as stalled when idle for"
                    {...form.getInputProps("session.queue-stalled-enabled", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={0}
                    {...form.getInputProps("session.queue-stalled-minutes")}
                    disabled={session["queue-stalled-enabled"] !== true} />
            </Grid.Col>
            <Grid.Col span={2}>minutes</Grid.Col>
        </Grid>
    );
}

export function DaemonSettingsModal(props: ModalState) {
    const { data: session, fetchStatus } = useSessionFull(props.opened);
    const mutation = useMutateSession();
    const serverConfig = useContext(ServerConfigContext);

    const form = useForm<FormValues>({
        initialValues: {
            intervals: serverConfig.intervals,
            session
        }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { form.setFieldValue("session", session); }, [session]);

    const onSave = useCallback(() => {
        serverConfig.intervals = { ...form.values.intervals };
        if (form.values.session !== undefined) {
            mutation.mutate(form.values.session, {
                onSuccess: () => {
                    notifications.show({
                        message: "Session saved successfully",
                        color: "green",
                    });
                    props.close();
                },
                onError: (error) => {
                    notifications.show({
                        title: "Failed to update daemon settings",
                        message: String(error),
                        color: "red",
                    });
                }
            });
        } else {
            props.close();
        }
    }, [form.values, mutation, props, serverConfig]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            saveLoading={mutation.isLoading}
            centered
            title="Server Settings"
        >
            <Box pos="relative">
                <LoadingOverlay visible={fetchStatus === "fetching"} overlayBlur={2} />
                <Tabs defaultValue="polling" mih="25rem">
                    <Tabs.List>
                        <Tabs.Tab value="polling" p="lg">Polling</Tabs.Tab>
                        <Tabs.Tab value="download" p="lg">Download</Tabs.Tab>
                        <Tabs.Tab value="network" p="lg">Network</Tabs.Tab>
                        <Tabs.Tab value="bandwidth" p="lg">Bandwidth</Tabs.Tab>
                        <Tabs.Tab value="queue" p="lg">Queue</Tabs.Tab>
                    </Tabs.List>
                    {form.values.session !== undefined
                        ? <>
                            <Tabs.Panel value="polling" pt="md">
                                <PollingPanel form={form} />
                            </Tabs.Panel>

                            <Tabs.Panel value="download" pt="md">
                                <DownloadPanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="network" pt="md">
                                <NetworkPanel opened={props.opened} form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="bandwidth" pt="md">
                                <BandwidthPanel form={form} session={form.values.session} />
                            </Tabs.Panel>

                            <Tabs.Panel value="queue" pt="md">
                                <QueuePanel form={form} session={form.values.session} />
                            </Tabs.Panel>
                        </>
                        : <></>}
                </Tabs>
            </Box>
        </SaveCancelModal>
    );
}
