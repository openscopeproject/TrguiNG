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

import React, { useContext, useEffect, useMemo, useState } from "react";
import { byteRateToHumanReadableStr, bytesToHumanReadableStr } from "../trutil";
import * as Icon from "react-bootstrap-icons";
import { Box, Flex, Menu } from "@mantine/core";
import type { SessionInfo } from "rpc/client";
import type { Torrent } from "rpc/torrent";
import { ColorSchemeToggle, ShowVersion } from "components/miscbuttons";
import { ConfigContext } from "config";
import { useContextMenu } from "./contextmenu";
import { MemoSectionsContextMenu, getSectionsMap } from "./sectionscontextmenu";

const TAURI = Object.prototype.hasOwnProperty.call(window, "__TAURI__");

export interface StatusbarProps {
    session: SessionInfo | undefined,
    torrents: Torrent[],
    filteredTorrents: Torrent[],
    selectedTorrents: Set<number>,
    hostname: string,
}

export function Statusbar({ session, torrents, filteredTorrents, selectedTorrents, hostname }: StatusbarProps) {
    const config = useContext(ConfigContext);

    const serverFields = useMemo(() => ({
        downRateLimit: session !== undefined
            ? session["alt-speed-enabled"] === true
                ? session["alt-speed-down"] as number
                : session["speed-limit-down-enabled"] === true
                    ? session["speed-limit-down"] as number
                    : -1
            : -1,
        upRateLimit: session !== undefined
            ? session["alt-speed-enabled"] === true
                ? session["alt-speed-up"] as number
                : session["speed-limit-up-enabled"] === true
                    ? session["speed-limit-up"] as number
                    : -1
            : -1,
        free: session?.["download-dir-free-space"] as number ?? 0,
    }), [session]);

    const [sizeSelected, sizeDone, sizeLeft] = useMemo(() => {
        const selected = filteredTorrents.filter((t) => selectedTorrents.has(t.id));

        return [
            bytesToHumanReadableStr(selected.reduce((p, t) => p + (t.sizeWhenDone as number), 0)),
            bytesToHumanReadableStr(selected.reduce((p, t) => p + (t.haveValid as number), 0)),
            bytesToHumanReadableStr(selected.reduce((p, t) => p + Math.max(t.sizeWhenDone - t.haveValid, 0), 0)),
        ];
    }, [filteredTorrents, selectedTorrents]);

    const [showGlobalSpeeds, setShowGlobalSpeeds] = useState(config.values.interface.statusBarGlobalSpeeds);
    const [sections, setSections] = useState(config.values.interface.statusBarSections);
    const [sectionsMap, setSectionsMap] = useState(getSectionsMap(sections));

    useEffect(() => {
        config.values.interface.statusBarGlobalSpeeds = showGlobalSpeeds;
        config.values.interface.statusBarSections = sections;
        setSectionsMap(getSectionsMap(sections));
    }, [config, showGlobalSpeeds, sections]);

    const [downRate, upRate, sizeTotal] = useMemo(() => [
        bytesToHumanReadableStr(
            (showGlobalSpeeds ? torrents : filteredTorrents)
                .reduce((p, t) => p + (t.rateDownload as number), 0),
        ),
        bytesToHumanReadableStr(
            (showGlobalSpeeds ? torrents : filteredTorrents)
                .reduce((p, t) => p + (t.rateUpload as number), 0),
        ),
        bytesToHumanReadableStr(filteredTorrents.reduce((p, t) => p + (t.sizeWhenDone as number), 0)),
    ], [showGlobalSpeeds, torrents, filteredTorrents]);

    useEffect(() => {
        document.title = `↓${downRate}/s ↑${upRate}/s - TrguiNG`;
    }, [downRate, upRate]);

    const [info, setInfo, handler] = useContextMenu();

    return (
        <Flex className="statusbar" sx={{ flexWrap: "nowrap" }} onContextMenu={handler} gap="md">
            <MemoSectionsContextMenu
                sections={sections} setSections={setSections}
                contextMenuInfo={info} setContextMenuInfo={setInfo}>
                <Menu.Divider/>
                <Menu.Item
                    icon={showGlobalSpeeds ? <Icon.Check size="1rem" /> : <Box miw="1rem" />}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        setShowGlobalSpeeds(!showGlobalSpeeds);
                    }}
                >
                    Show global speeds
                </Menu.Item>
            </MemoSectionsContextMenu>
            {sections[sectionsMap.Connection].visible &&
                <div style={{ flex: "1 1 23%", order: sectionsMap.Connection }}>
                    <Box component="span" my="auto" mr="xs"><Icon.Diagram2 /></Box>
                    <span>{`${session?.version as string ?? "<not connected>"} at ${hostname}`}</span>
                </div>}
            {sections[sectionsMap["Download speed "]].visible &&
                <div style={{ flex: "1 1 15%", order: sectionsMap["Download speed "] }}>
                    <Box component="span" my="auto" mr="xs">{showGlobalSpeeds && <Icon.Globe />}<Icon.ArrowDown /></Box>
                    <span>{`${downRate}/s (${byteRateToHumanReadableStr(serverFields.downRateLimit * 1024)})`}</span>
                </div>}
            {sections[sectionsMap["Upload speed"]].visible &&
                <div style={{ flex: "1 1 15%", order: sectionsMap["Upload speed"] }}>
                    <Box component="span" my="auto" mr="xs">{showGlobalSpeeds && <Icon.Globe />}<Icon.ArrowUp /></Box>
                    <span>{`${upRate}/s (${byteRateToHumanReadableStr(serverFields.upRateLimit * 1024)})`}</span>
                </div>}
            {sections[sectionsMap["Free space"]].visible &&
                <div style={{ flex: "1 1 12%", order: sectionsMap["Free space"] }}>
                    <Box component="span" my="auto" mr="xs"><Icon.Hdd /></Box>
                    <span>{`Free: ${bytesToHumanReadableStr(serverFields.free)}`}</span>
                </div>}
            {sections[sectionsMap.Total].visible &&
                <div style={{ flex: "1 1 12%", order: sectionsMap.Total }}>
                    {`Total: ${sizeTotal}`}
                </div>}
            {sections[sectionsMap.Selected].visible &&
                <div style={{ flex: "1 1 23%", order: sectionsMap.Selected }}>
                    {`Selected: ${sizeSelected}, done ${sizeDone}, left ${sizeLeft}`}
                </div>}
            {!TAURI &&
                <div style={{ flexShrink: 0, display: "flex", order: 100 }}>
                    <ShowVersion sz="0.9rem" btn="md" />
                    <ColorSchemeToggle sz="0.9rem" btn="md" />
                </div>}
        </Flex>
    );
}
