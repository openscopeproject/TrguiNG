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

import { Anchor, Box, Divider, Flex, Grid, Modal, Text } from "@mantine/core";
import type { ModalState } from "./common";
import appVersionJson from "build/version.json";
import React from "react";
import ReactLogo from "svg/reactjs.svg";
import TauriLogo from "svg/tauri.svg";
import AppLogo from "svg/app.svg";
import { Github } from "react-bootstrap-icons";

interface AppVersion {
    readonly gitVersion: string,
    readonly backendVersion: string,
    readonly buildDate: number,
}

const appVersion: AppVersion = appVersionJson;

export function VersionModal({ opened, close }: ModalState) {
    return (
        <Modal opened={opened} onClose={close} size="lg">
            <h2>Transmission Remote GUI (next gen)</h2>
            <h5>
                Remote interface for&nbsp;
                <Anchor href="https://transmissionbt.com/" target="_blank" rel="noreferrer">Transmission</Anchor>
                &nbsp;torrent daemon
            </h5>
            <Divider px="sm" my="xl" />
            <Flex gap="md" align="center">
                <img src={AppLogo} />
                <Grid>
                    <Grid.Col span={4}>Source code</Grid.Col>
                    <Grid.Col span={8}><Box component="span" mr="sm"><Github /></Box><Anchor href="https://github.com/openscopeproject/transguing/" target="_blank" rel="noreferrer">github</Anchor></Grid.Col>
                    <Grid.Col span={4}>Version</Grid.Col>
                    <Grid.Col span={8}>{appVersion.gitVersion}</Grid.Col>
                    <Grid.Col span={4}>Backend</Grid.Col>
                    <Grid.Col span={8}>{appVersion.backendVersion}</Grid.Col>
                    <Grid.Col span={4}>Build date</Grid.Col>
                    <Grid.Col span={8}>{new Date(appVersion.buildDate).toLocaleString()}</Grid.Col>
                </Grid>
            </Flex>
            <Divider px="sm" my="xl" />

            <Text align="center">
                powered by
            </Text>
            <Flex justify="center">
                <Anchor href="https://react.dev/" target="_blank" rel="noreferrer"><img src={ReactLogo} /></Anchor>
                <Anchor href="https://tauri.app/" target="_blank" rel="noreferrer"><img src={TauriLogo} /></Anchor>
            </Flex>
        </Modal>
    );
}
