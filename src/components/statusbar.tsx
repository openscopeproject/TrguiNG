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

import React from "react";
import { byteRateToHumanReadableStr, bytesToHumanReadableStr } from "../util";
import * as Icon from "react-bootstrap-icons";
import { Container, Group } from "@mantine/core";

export interface StatusbarProps {
    daemon_version: string,
    hostname: string,
    downRate: number,
    downRateLimit: number,
    upRate: number,
    upRateLimit: number,
    free: number,
    sizeTotal: number,
    sizeSelected: number,
    sizeDone: number,
    sizeLeft: number,
}

export function Statusbar(props: StatusbarProps) {
    return (
        <Container fluid>
            <Group className="statusbar" styles={{root: {"flex-wrap": "nowrap"}}}>
                <div>
                    <Icon.Diagram2 className="me-2" />
                    <span>{`${props.daemon_version} at ${props.hostname}`}</span>
                </div>
                <div>
                    <Icon.ArrowDown className="me-2" />
                    <span>{`${bytesToHumanReadableStr(props.downRate)}/s (${byteRateToHumanReadableStr(props.downRateLimit * 1024)})`}</span>
                </div>
                <div>
                    <Icon.ArrowUp className="me-2" />
                    <span>{`${bytesToHumanReadableStr(props.upRate)}/s (${byteRateToHumanReadableStr(props.upRateLimit * 1024)})`}</span>
                </div>
                <div>
                    <Icon.Hdd className="me-2" />
                    <span>{`Free: ${bytesToHumanReadableStr(props.free)}`}</span>
                </div>
                <div>
                    {`Total: ${bytesToHumanReadableStr(props.sizeTotal)}`}
                </div>
                <div>
                    {`Selected: ${bytesToHumanReadableStr(props.sizeSelected)}, done ${bytesToHumanReadableStr(props.sizeDone)}, left ${bytesToHumanReadableStr(props.sizeLeft)}`}
                </div>
            </Group>
        </Container>
    );
}
