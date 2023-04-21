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

import React, { useMemo } from "react";
import { byteRateToHumanReadableStr, bytesToHumanReadableStr } from "../util";
import * as Icon from "react-bootstrap-icons";
import { Container, Group } from "@mantine/core";
import { SessionInfo } from "rpc/client";
import { Torrent } from "rpc/torrent";

export interface StatusbarProps {
    session: SessionInfo | undefined,
    filteredTorrents: Torrent[],
    selectedTorrents: Set<number>,
    hostname: string,
}

export function Statusbar({ session, filteredTorrents, selectedTorrents, hostname }: StatusbarProps) {
    const serverFields = useMemo(() => {
        return {
            downRateLimit: session ?
                session["speed-limit-down-enabled"] ?
                    session["alt-speed-enabled"] ?
                        session["alt-speed-down"]
                        : session["speed-limit-down"]
                    : -1
                : -1,
            upRateLimit: session ?
                session["speed-limit-up-enabled"] ?
                    session["alt-speed-enabled"] ?
                        session["alt-speed-up"]
                        : session["speed-limit-up"]
                    : -1
                : -1,
            free: session?.["download-dir-free-space"] || 0,
        }
    }, [session]);

    const [downRate, upRate, sizeTotal] = useMemo(() => [
        filteredTorrents.reduce((p, t) => p + t.rateDownload, 0),
        bytesToHumanReadableStr(filteredTorrents.reduce((p, t) => p + t.sizeWhenDone, 0)),
        bytesToHumanReadableStr(filteredTorrents.reduce((p, t) => p + t.rateUpload, 0)),
    ], [filteredTorrents]);

    const [sizeSelected, sizeDone, sizeLeft] = useMemo(() => {
        const selected = filteredTorrents.filter((t) => selectedTorrents.has(t.id));

        return [
            bytesToHumanReadableStr(selected.reduce((p, t) => p + t.sizeWhenDone, 0)),
            bytesToHumanReadableStr(selected.reduce((p, t) => p + t.haveValid, 0)),
            bytesToHumanReadableStr(selected.reduce((p, t) => p + t.leftUntilDone, 0)),
        ]
    }, [filteredTorrents, selectedTorrents]);

    return (
        <Container fluid>
            <Group className="statusbar" styles={{ root: { "flex-wrap": "nowrap" } }}>
                <div>
                    <Icon.Diagram2 className="me-2" />
                    <span>{`${session?.version || "<not connected>"} at ${hostname}`}</span>
                </div>
                <div>
                    <Icon.ArrowDown className="me-2" />
                    <span>{`${bytesToHumanReadableStr(downRate)}/s (${byteRateToHumanReadableStr(serverFields.downRateLimit * 1024)})`}</span>
                </div>
                <div>
                    <Icon.ArrowUp className="me-2" />
                    <span>{`${upRate}/s (${byteRateToHumanReadableStr(serverFields.upRateLimit * 1024)})`}</span>
                </div>
                <div>
                    <Icon.Hdd className="me-2" />
                    <span>{`Free: ${bytesToHumanReadableStr(serverFields.free)}`}</span>
                </div>
                <div>
                    {`Total: ${sizeTotal}`}
                </div>
                <div>
                    {`Selected: ${sizeSelected}, done ${sizeDone}, left ${sizeLeft}`}
                </div>
            </Group>
        </Container>
    );
}
