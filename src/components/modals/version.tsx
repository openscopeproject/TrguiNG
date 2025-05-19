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

import { Anchor, Box, Divider, Flex, Grid, Text, Title } from "@mantine/core";
import type { ModalState } from "./common";
import { HkModal } from "./common";
import appVersionJson from "build/version.json";
import React, { useEffect, useState } from "react";
import ReactLogo from "svg/reactjs.svg";
import TauriLogo from "svg/tauri.svg";
import AppLogo from "svg/app.svg";
import { Github } from "react-bootstrap-icons";
import { UAParser } from "ua-parser-js";
const { TAURI } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface AppVersion {
    readonly gitVersion: string,
    readonly backendVersion: string,
    readonly buildDate: number,
}

export const appVersion: AppVersion = appVersionJson;

export function VersionModal({ opened, close }: ModalState) {
    const [frontend, setFrontend] = useState<string>();

    useEffect(() => {
        if (opened && frontend === undefined) {
            const { browser, engine, os } = UAParser();
            let frontend = `${browser.name ?? "unknown"} ${browser.version ?? ""} `;
            frontend += `(${engine.name ?? "unknown"} ${engine.version ?? ""}) `;
            frontend += `on ${os.name ?? "unknown"} ${os.version ?? ""}`;
            setFrontend(frontend);
        }
    }, [opened, frontend]);

    return (
        <HkModal opened={opened} onClose={close} size="lg" centered p="lg">
            <Title order={2} mb="lg">TrguiNG</Title>
            <Text>
                Remote interface for&nbsp;
                <Anchor href="https://transmissionbt.com/" target="_blank" rel="noreferrer">Transmission</Anchor>
                &nbsp;torrent daemon
            </Text>
            <Divider px="sm" my="xl" />
            <Flex gap="md" align="center">
                <AppLogo style={{ flexShrink: 0 }} />
                <Grid>
                    <Grid.Col span={4}>Version</Grid.Col>
                    <Grid.Col span={8}>{appVersion.gitVersion}</Grid.Col>
                    <Grid.Col span={4}>Frontend</Grid.Col>
                    <Grid.Col span={8}>{frontend}</Grid.Col>
                    <Grid.Col span={4}>Build date</Grid.Col>
                    <Grid.Col span={8}>{new Date(appVersion.buildDate).toLocaleString()}</Grid.Col>
                    <Grid.Col span={4}>Source code</Grid.Col>
                    <Grid.Col span={8}><Box component="span" mr="sm"><Github /></Box><Anchor href="https://github.com/openscopeproject/trguing/" target="_blank" rel="noreferrer">github</Anchor></Grid.Col>
                    <Grid.Col mt="xl">{TAURI && <Anchor href="https://db-ip.com" target="_blank" rel="noreferrer">IP Geolocation by DB-IP</Anchor>}</Grid.Col>
                </Grid>
            </Flex>
            <Divider px="sm" my="xl" />
            <Text align="center">
                powered by
            </Text>
            <Flex justify="center">
                <Anchor href="https://react.dev/" target="_blank" rel="noreferrer"><ReactLogo /></Anchor>
                <Anchor href="https://tauri.app/" target="_blank" rel="noreferrer"><TauriLogo /></Anchor>
            </Flex>
        </HkModal>
    );
}
