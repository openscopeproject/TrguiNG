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

import { useTranslation } from "react-i18next";
import { Anchor, Box, Divider, Flex, Grid, Text } from "@mantine/core";
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
    const { t, i18n } = useTranslation();
    const [frontend, setFrontend] = useState<ReturnType<typeof UAParser>>();

    useEffect(() => {
        if (opened && frontend === undefined) {
            setFrontend(UAParser());
        }
    }, [opened, frontend]);

    return (
        <HkModal
            opened={opened}
            onClose={close}
            size="lg"
            centered
            p="lg"
            styles={{ header: { padding: "1em", alignItems: "start" } }}
            title={<Text size="2em" fw="bold">TrguiNG</Text>}
        >
            <Text>
                {t("version.remoteInterfaceFor")}
                {" "}
                <Anchor href="https://transmissionbt.com/" target="_blank" rel="noreferrer">Transmission</Anchor>
                {" "}
                {t("version.torrentDaemon")}
            </Text>
            <Divider px="sm" my="xl" />
            <Flex gap="md" align="center">
                <AppLogo style={{ flexShrink: 0 }} />
                <Grid>
                    <Grid.Col span={4}>{t("version.version")}</Grid.Col>
                    <Grid.Col span={8}>{appVersion.gitVersion}</Grid.Col>
                    <Grid.Col span={4}>{t("version.frontend")}</Grid.Col>
                    <Grid.Col span={8}>
                        {frontend === undefined
                            ? ""
                            : t("version.frontendDescription", {
                                browser: `${frontend.browser.name ?? t("version.unknown")} ${frontend.browser.version ?? ""}`.trim(),
                                engine: `${frontend.engine.name ?? t("version.unknown")} ${frontend.engine.version ?? ""}`.trim(),
                                os: `${frontend.os.name ?? t("version.unknown")} ${frontend.os.version ?? ""}`.trim(),
                            })}
                    </Grid.Col>
                    <Grid.Col span={4}>{t("version.buildDate")}</Grid.Col>
                    <Grid.Col span={8}>{new Date(appVersion.buildDate).toLocaleString(i18n.resolvedLanguage)}</Grid.Col>
                    <Grid.Col span={4}>{t("version.sourceCode")}</Grid.Col>
                    <Grid.Col span={8}>
                        <Box component="span" mr="sm"><Github /></Box>
                        <Anchor href="https://github.com/openscopeproject/trguing/" target="_blank" rel="noreferrer">github</Anchor>
                    </Grid.Col>
                    <Grid.Col mt="xl">{TAURI && <Anchor href="https://db-ip.com" target="_blank" rel="noreferrer">{t("version.ipGeolocation")}</Anchor>}</Grid.Col>
                </Grid>
            </Flex>
            <Divider px="sm" my="xl" />
            <Text ta="center">{t("version.poweredBy")}</Text>
            <Flex justify="center">
                <Anchor href="https://react.dev/" target="_blank" rel="noreferrer"><ReactLogo /></Anchor>
                <Anchor href="https://tauri.app/" target="_blank" rel="noreferrer"><TauriLogo /></Anchor>
            </Flex>
        </HkModal>
    );
}
