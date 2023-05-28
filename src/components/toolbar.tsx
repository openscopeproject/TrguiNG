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

import type { MantineTheme } from "@mantine/core";
import { Button, Flex, Menu, TextInput } from "@mantine/core";
import debounce from "lodash-es/debounce";
import React, { forwardRef, memo, useCallback, useEffect, useMemo, useState } from "react";
import * as Icon from "react-bootstrap-icons";
import type { PriorityNumberType } from "rpc/transmission";
import { BandwidthPriority } from "rpc/transmission";
import type { TorrentMutationVariables } from "queries";
import { useTorrentAction, useMutateSession, useMutateTorrent } from "queries";
import type { UseMutationResult } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import type { ServerTorrentData } from "rpc/torrent";
import type { TorrentActionMethodsType } from "rpc/client";
import type { ModalCallbacks } from "./modals/servermodals";

interface ToolbarButtonProps extends React.PropsWithChildren<React.ComponentPropsWithRef<"button">> {
    depressed?: boolean,
}

// eslint-disable-next-line react/display-name
const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>((
    { children, depressed, ...other }: ToolbarButtonProps, ref,
) => {
    return (
        <Button variant="light" color="gray" compact h="2.5rem" {...other} ref={ref}
            styles={(theme: MantineTheme) => ({
                root: {
                    backgroundColor: theme.colorScheme === "dark"
                        ? theme.colors.gray[depressed === true ? 8 : 9]
                        : theme.colors.gray[depressed === true ? 3 : 1],
                    transform: depressed === true ? "scale(-1, 1)" : "none",
                },
            })}
        >
            {children}
        </Button>
    );
});

interface ToolbarProps {
    setSearchTerms: (terms: string[]) => void,
    modals: React.RefObject<ModalCallbacks>,
    serverData: React.MutableRefObject<ServerTorrentData>,
    altSpeedMode: boolean,
}

function useSimpleActionHandler(method: TorrentActionMethodsType, props: ToolbarProps) {
    const mutation = useTorrentAction();

    return useCallback(() => {
        mutation.mutate(
            {
                method,
                torrentIds: Array.from(props.serverData.current.selected),
            },
            {
                onError: (e) => {
                    console.log("Error running torrent update method", method, e);
                    notifications.show({
                        message: "Error updating torrent",
                        color: "red",
                    });
                },
            },
        );
    }, [mutation, method, props.serverData]);
}

function usePriorityHandler(
    priority: PriorityNumberType,
    props: ToolbarProps,
    mutation: UseMutationResult<void, unknown, TorrentMutationVariables>,
) {
    return useCallback(() => {
        mutation.mutate(
            {
                torrentIds: Array.from(props.serverData.current.selected),
                fields: { bandwidthPriority: priority },
            },
            {
                onSuccess: () => {
                    notifications.show({
                        message: "Priority is updated",
                        color: "green",
                    });
                },
                onError: (error) => {
                    notifications.show({
                        title: "Failed to update priority",
                        message: String(error),
                        color: "red",
                    });
                },
            },
        );
    }, [props.serverData, priority, mutation]);
}

function Toolbar(props: ToolbarProps) {
    const debouncedSetSearchTerms = useMemo(
        () => debounce(props.setSearchTerms, 500, { trailing: true, leading: false }),
        [props.setSearchTerms]);

    const [altSpeedMode, setAltSpeedMode] = useState<boolean>();

    const sessionMutation = useMutateSession();

    const toggleAltSpeedMode = useCallback(() => {
        sessionMutation.mutate({ "alt-speed-enabled": altSpeedMode !== true }, {
            onError: (_, session) => {
                setAltSpeedMode(session["alt-speed-enabled"] !== true);
            },
        });
        setAltSpeedMode(altSpeedMode !== true);
    }, [altSpeedMode, sessionMutation]);

    useEffect(() => {
        if (props.altSpeedMode !== undefined) setAltSpeedMode(props.altSpeedMode);
    }, [props.altSpeedMode]);

    const torrentMutation = useMutateTorrent();

    const onSearchInput = useCallback((e: React.FormEvent) => {
        debouncedSetSearchTerms(
            (e.target as HTMLInputElement).value
                .split(" ")
                .map((s) => s.trim().toLowerCase())
                .filter((s) => s !== ""));
    }, [debouncedSetSearchTerms]);

    return (
        <Flex w="100%" align="stretch">
            <Button.Group mx="sm">
                <ToolbarButton onClick={() => { props.modals.current?.addTorrent(); }}>
                    <Icon.FileArrowDownFill size="1.5rem" color="seagreen" />
                </ToolbarButton>
                <ToolbarButton onClick={() => { props.modals.current?.addMagnet(); }}>
                    <Icon.MagnetFill size="1.5rem" color="seagreen" />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton onClick={useSimpleActionHandler("torrent-start", props)} >
                    <Icon.PlayCircleFill size="1.5rem" color="steelblue" />
                </ToolbarButton>
                <ToolbarButton onClick={useSimpleActionHandler("torrent-stop", props)} >
                    <Icon.PauseCircleFill size="1.5rem" color="steelblue" />
                </ToolbarButton>
                <ToolbarButton onClick={() => { props.modals.current?.remove(); }}>
                    <Icon.XCircleFill size="1.5rem" color="tomato" />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton onClick={useSimpleActionHandler("queue-move-up", props)} >
                    <Icon.ArrowUpCircleFill size="1.5rem" color="seagreen" />
                </ToolbarButton>
                <ToolbarButton onClick={useSimpleActionHandler("queue-move-down", props)} >
                    <Icon.ArrowDownCircleFill size="1.5rem" color="seagreen" />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton onClick={() => { props.modals.current?.move(); }}>
                    <Icon.FolderFill size="1.5rem" color="gold" />
                </ToolbarButton>
                <ToolbarButton onClick={() => { props.modals.current?.setLabels(); }} >
                    <Icon.TagsFill size="1.5rem" color="steelblue" />
                </ToolbarButton>

                <Menu shadow="md" width={200} withinPortal middlewares={{ shift: true, flip: false }}>
                    <Menu.Target>
                        <ToolbarButton><Icon.ExclamationDiamondFill size="1.5rem" color="gold" /></ToolbarButton>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <Menu.Label>Set priority</Menu.Label>
                        <Menu.Item icon={<Icon.CircleFill color="tomato" />}
                            onClick={usePriorityHandler(BandwidthPriority.high, props, torrentMutation)}>
                            High
                        </Menu.Item>
                        <Menu.Item icon={<Icon.CircleFill color="seagreen" />}
                            onClick={usePriorityHandler(BandwidthPriority.normal, props, torrentMutation)}>
                            Normal
                        </Menu.Item>
                        <Menu.Item icon={<Icon.CircleFill color="gold" />}
                            onClick={usePriorityHandler(BandwidthPriority.low, props, torrentMutation)}>
                            Low
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Button.Group>

            <ToolbarButton
                title={`Turn alternative bandwidth mode ${altSpeedMode === true ? "off" : "on"}`}
                onClick={toggleAltSpeedMode}
                depressed={altSpeedMode}
            >
                <Icon.Speedometer2 size="1.5rem" />
            </ToolbarButton>

            <TextInput mx="sm" className="flex-grow-1"
                icon={<Icon.Search size="1rem" />}
                placeholder="search"
                onInput={onSearchInput}
                styles={{ input: { height: "auto" } }}
            />

            <ToolbarButton onClick={() => { props.modals.current?.daemonSettings(); }}>
                <Icon.Tools size="1.5rem" />
            </ToolbarButton>
        </Flex >
    );
}

export const MemoizedToolbar = memo(Toolbar) as typeof Toolbar;
