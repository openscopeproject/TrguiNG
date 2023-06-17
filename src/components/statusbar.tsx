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

import React, { useMemo } from "react";
import { byteRateToHumanReadableStr, bytesToHumanReadableStr } from "../util";
import * as Icon from "react-bootstrap-icons";
import { Box, Group } from "@mantine/core";
import type { SessionInfo } from "rpc/client";
import type { Torrent } from "rpc/torrent";
import { ColorSchemeToggle, ShowVersion } from "components/miscbuttons";

const TAURI = Object.prototype.hasOwnProperty.call(window, "__TAURI__");

export interface StatusbarProps {
    session: SessionInfo | undefined,
    filteredTorrents: Torrent[],
    selectedTorrents: Set<number>,
    hostname: string,
}

export function Statusbar({ session, filteredTorrents, selectedTorrents, hostname }: StatusbarProps) {
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

    const [downRate, upRate, sizeTotal] = useMemo(() => [
        bytesToHumanReadableStr(filteredTorrents.reduce((p, t) => p + (t.rateDownload as number), 0)),
        bytesToHumanReadableStr(filteredTorrents.reduce((p, t) => p + (t.rateUpload as number), 0)),
        bytesToHumanReadableStr(filteredTorrents.reduce((p, t) => p + (t.sizeWhenDone as number), 0)),
    ], [filteredTorrents]);

    const [sizeSelected, sizeDone, sizeLeft] = useMemo(() => {
        const selected = filteredTorrents.filter((t) => selectedTorrents.has(t.id));

        return [
            bytesToHumanReadableStr(selected.reduce((p, t) => p + (t.sizeWhenDone as number), 0)),
            bytesToHumanReadableStr(selected.reduce((p, t) => p + (t.haveValid as number), 0)),
            bytesToHumanReadableStr(selected.reduce((p, t) => p + Math.max(t.sizeWhenDone - t.haveValid, 0), 0)),
        ];
    }, [filteredTorrents, selectedTorrents]);

    return (
        <Group className="statusbar" h="100%" sx={{ flexWrap: "nowrap" }}>
            <div>
                <Box component="span" my="auto" mr="xs"><Icon.Diagram2 /></Box>
                <span>{`${session?.version as string ?? "<not connected>"} at ${hostname}`}</span>
            </div>
            <div>
                <Box component="span" my="auto" mr="xs"><Icon.ArrowDown /></Box>
                <span>{`${downRate}/s (${byteRateToHumanReadableStr(serverFields.downRateLimit * 1024)})`}</span>
            </div>
            <div>
                <Box component="span" my="auto" mr="xs"><Icon.ArrowUp /></Box>
                <span>{`${upRate}/s (${byteRateToHumanReadableStr(serverFields.upRateLimit * 1024)})`}</span>
            </div>
            <div>
                <Box component="span" my="auto" mr="xs"><Icon.Hdd /></Box>
                <span>{`Free: ${bytesToHumanReadableStr(serverFields.free)}`}</span>
            </div>
            <div>
                {`Total: ${sizeTotal}`}
            </div>
            <div>
                {`Selected: ${sizeSelected}, done ${sizeDone}, left ${sizeLeft}`}
            </div>
            <div style={{ flexGrow: 1 }} />
            {!TAURI &&
                <div style={{ flexShrink: 0, display: "flex" }}>
                    <ShowVersion sz="0.9rem" btn="md"/>
                    <ColorSchemeToggle sz="0.9rem" btn="md"/>
                </div>}
        </Group>
    );
}
