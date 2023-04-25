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

import { Box, Button, Checkbox, Grid, LoadingOverlay, NativeSelect, NumberInput, Tabs, Text, TextInput } from "@mantine/core";
import { ServerConfigContext } from "config";
import React, { useCallback, useContext, useEffect } from "react";
import { ModalState, SaveCancelModal } from "./common";
import { useSessionFull } from "queries";
import { useForm } from "@mantine/form";
import { ActionController } from "actions";

interface DaemonSettingsProps extends ModalState {
    actionController: ActionController,
}

export function DaemonSettingsModal(props: DaemonSettingsProps) {
    const { data: session, fetchStatus } = useSessionFull(props.actionController.client, props.opened);
    const serverConfig = useContext(ServerConfigContext);

    const form = useForm({
        initialValues: {
            intervals: serverConfig.intervals,
            session: session
        }
    });

    useEffect(() => form.setFieldValue("session", session), [session]);

    console.log(form.values.session);

    const onTestPort = useCallback(() => {
        props.actionController.client.testPort().then(console.log);
    }, [props.actionController.client]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={() => { serverConfig.intervals = form.values.intervals; }}
            centered
            title="Edit Server Connections"
        >
            <Box pos="relative">
                <LoadingOverlay visible={fetchStatus == "fetching"} overlayBlur={2} />
                <Tabs orientation="vertical" defaultValue="polling" mih="30rem">
                    <Tabs.List>
                        <Tabs.Tab value="polling" p="lg">Polling</Tabs.Tab>
                        <Tabs.Tab value="download" p="lg">Download</Tabs.Tab>
                        <Tabs.Tab value="network" p="lg">Network</Tabs.Tab>
                        <Tabs.Tab value="bandwidth" p="lg">Bandwidth</Tabs.Tab>
                        <Tabs.Tab value="queue" p="lg">Queue</Tabs.Tab>
                    </Tabs.List>
                    {form.values.session !== undefined ? <>
                        <Tabs.Panel value="polling" pl="md">
                            <Grid>
                                <Grid.Col span={12}><Text>Update intervals (sec)</Text></Grid.Col>

                                <Grid.Col span={6}>
                                    <NumberInput
                                        label="Session"
                                        min={1}
                                        max={3600}
                                        {...form.getInputProps("intervals.session")}
                                    />
                                </Grid.Col>
                                <Grid.Col span={6}>
                                    <NumberInput
                                        label="Torrent details"
                                        min={1}
                                        max={3600}
                                        {...form.getInputProps("intervals.details")}
                                    />
                                </Grid.Col>
                                <Grid.Col span={6}>
                                    <NumberInput
                                        label="Torrents"
                                        min={1}
                                        max={3600}
                                        {...form.getInputProps("intervals.torrents")}
                                    />
                                </Grid.Col>
                                <Grid.Col span={6}>
                                    <NumberInput
                                        label="Torrents minimized"
                                        min={1}
                                        max={3600}
                                        {...form.getInputProps("intervals.torrentsMinimized")}
                                    />
                                </Grid.Col>
                            </Grid>
                        </Tabs.Panel>

                        <Tabs.Panel value="download" pl="md">
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
                                        {...form.getInputProps("session.incomplete-dir")} />
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
                                        disabled={form.values.session!.seedRatioLimited !== true}
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
                                        disabled={form.values.session!["idle-seeding-limit-enabled"] !== true}
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
                        </Tabs.Panel>

                        <Tabs.Panel value="network" pl="md">
                            <Grid align="center">
                                <Grid.Col span={3}>
                                    Incoming port:
                                </Grid.Col>
                                <Grid.Col span={3}>
                                    <NumberInput
                                        min={1}
                                        max={65535}
                                        {...form.getInputProps("session.peer-port")}
                                        disabled={form.values.session!["peer-port-random-on-start"] === true}
                                    />
                                </Grid.Col>
                                <Grid.Col span={3}>
                                    <Button
                                        w="100%"
                                        onClick={onTestPort}
                                        title="Save port changes before testing">
                                        Test port
                                    </Button>
                                </Grid.Col>
                                <Grid.Col span={3}></Grid.Col>
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
                                        disabled={form.values.session["blocklist-enabled"] !== true} />
                                </Grid.Col>
                            </Grid>
                        </Tabs.Panel>

                        <Tabs.Panel value="bandwidth" pl="md">
                            bandwidth tab content
                        </Tabs.Panel>

                        <Tabs.Panel value="queue" pl="md">
                            queue tab content
                        </Tabs.Panel>
                    </> : <></>}
                </Tabs>
            </Box>
        </SaveCancelModal>
    );
}
