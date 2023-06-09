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

import { useMantineTheme } from "@mantine/core";
import React from "react";
import * as Icon from "react-bootstrap-icons";
import { Status } from "rpc/transmission";

export function All() {
    const theme = useMantineTheme();
    return <Icon.Asterisk size="1rem" stroke={theme.colors.orange[3]} fill={theme.colors.yellow[3]} />;
}

export function Downloading() {
    const theme = useMantineTheme();
    return <Icon.CaretDownSquareFill size="1rem" fill={theme.colors.indigo[5]} />;
}

export function Completed() {
    const theme = useMantineTheme();
    return <Icon.CaretUpSquareFill size="1rem" fill={theme.colors.green[7]} />;
}

export function Active() {
    const theme = useMantineTheme();
    return <Icon.Activity size="1rem" fill={theme.colors.red[6]} />;
}

export function Inactive() {
    const theme = useMantineTheme();
    return <Icon.Snow size="1rem" fill={theme.colors.cyan[4]} />;
}

export function Stopped() {
    const theme = useMantineTheme();
    return <Icon.PauseBtnFill size="1rem" fill={theme.colors.yellow[5]} />;
}

export function Error() {
    const theme = useMantineTheme();
    return <Icon.XSquareFill size="1rem" fill={theme.colors.red[9]} />;
}

export function Waiting() {
    const theme = useMantineTheme();
    return <Icon.ClockFill size="1rem" fill={theme.colors.cyan[4]} />;
}

export function Label() {
    const theme = useMantineTheme();
    return <Icon.TagsFill size="1rem" stroke={theme.colors.indigo[9]} fill={theme.colors.blue[4]} />;
}

export const StatusIconMap: Record<number, React.FC> = {
    [Status.stopped]: Stopped,
    [Status.queuedToVerify]: Waiting,
    [Status.queuedToDownload]: Waiting,
    [Status.queuedToSeed]: Waiting,
    [Status.verifying]: Waiting,
    [Status.downloading]: Downloading,
    [Status.seeding]: Completed,
} as const;
