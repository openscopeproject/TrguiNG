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

import { Button, Flex, MantineTheme, Menu, TextInput } from "@mantine/core";
import { debounce } from "lodash-es";
import React, { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import * as Icon from "react-bootstrap-icons";
import { ActionController, ActionMethodsType } from "../actions";
import { BandwidthPriority, PriorityNumberType } from "rpc/transmission";

interface ToolbarButtonProps extends React.PropsWithChildren<React.ComponentPropsWithRef<"button">> {
    depressed?: boolean
}

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>((
    { children, depressed, ...other }: ToolbarButtonProps, ref
) => {
    return (
        <Button variant="light" color="gray" compact h="2.5rem" {...other} ref={ref}
            styles={(theme: MantineTheme) => ({
                root: {
                    backgroundColor: theme.colorScheme == "dark" ?
                        theme.colors.gray[depressed ? 8 : 9]
                        : theme.colors.gray[depressed ? 3 : 1],
                    transform: depressed ? "scale(-1, 1)" : "none",
                }
            })}
        >
            {children}
        </Button>
    );
});

interface ToolbarProps {
    setSearchTerms: (terms: string[]) => void,
    actionController: ActionController,
    altSpeedMode: boolean,
}

function simpleActionHandler(action: ActionMethodsType, props: ToolbarProps) {
    return useCallback(() => {
        props.actionController.run(action).catch((e) => {
            console.log("Error for action", action, e);
        });
    }, [props.actionController]);
}

function priorityHandler(priority: PriorityNumberType, props: ToolbarProps) {
    return useCallback(() => {
        props.actionController.run("setPriority", priority).catch((e) => {
            console.log("Error setting priority", e);
        });
    }, [props.actionController]);
}

export function Toolbar(props: ToolbarProps) {
    const debouncedSetSearchTerms = useMemo(
        () => debounce(props.setSearchTerms, 500, { trailing: true, leading: false }),
        [props.setSearchTerms]);

    const [altSpeedMode, setAltSpeedMode] = useState<boolean>();

    const toggleAltSpeedMode = useCallback(() => {
        console.log("Toggling altspeedmode");
        props.actionController.run("setAltSpeedMode", !altSpeedMode)
            .catch((e) => {
                console.log("Can't set alt speed mode", e);
            });
        setAltSpeedMode(!altSpeedMode);
    }, [altSpeedMode]);

    useEffect(() => {
        if (props.altSpeedMode !== undefined)
            setAltSpeedMode(props.altSpeedMode);
    }, [props.altSpeedMode]);

    const onSearchInput = useCallback((e: React.FormEvent) => {
        debouncedSetSearchTerms(
            (e.target as HTMLInputElement).value
                .split(" ")
                .map((s) => s.trim().toLowerCase())
                .filter((s) => s != ""));
    }, [debouncedSetSearchTerms]);

    return (
        <Flex w="100%" py="md" align="stretch">
            <Button.Group mx="sm">
                <ToolbarButton><Icon.FileArrowDownFill size="1.5rem" color="seagreen" /></ToolbarButton>
                <ToolbarButton onClick={() => props.actionController.showModal("addMagnet")}>
                    <Icon.MagnetFill size="1.5rem" color="seagreen" />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton onClick={simpleActionHandler("resume", props)} >
                    <Icon.PlayCircleFill size="1.5rem" color="steelblue" />
                </ToolbarButton>
                <ToolbarButton onClick={simpleActionHandler("pause", props)} >
                    <Icon.PauseCircleFill size="1.5rem" color="steelblue" />
                </ToolbarButton>
                <ToolbarButton onClick={() => props.actionController.showModal("remove")}>
                    <Icon.XCircleFill size="1.5rem" color="tomato" />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton onClick={simpleActionHandler("moveQueueUp", props)} >
                    <Icon.ArrowUpCircleFill size="1.5rem" color="seagreen" />
                </ToolbarButton>
                <ToolbarButton onClick={simpleActionHandler("moveQueueDown", props)} >
                    <Icon.ArrowDownCircleFill size="1.5rem" color="seagreen" />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton onClick={() => props.actionController.showModal("move")}>
                    <Icon.FolderFill size="1.5rem" color="gold" />
                </ToolbarButton>
                <ToolbarButton onClick={() => props.actionController.showModal("setLabels")} >
                    <Icon.TagsFill size="1.5rem" color="steelblue" />
                </ToolbarButton>

                <Menu shadow="md" width={200} withinPortal>
                    <Menu.Target>
                        <ToolbarButton><Icon.ExclamationDiamondFill size="1.5rem" color="gold" /></ToolbarButton>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <Menu.Label>Set priority</Menu.Label>
                        <Menu.Item icon={<Icon.CircleFill color="tomato" />}
                            onClick={priorityHandler(BandwidthPriority.high, props)}>
                            High
                        </Menu.Item>
                        <Menu.Item icon={<Icon.CircleFill color="seagreen" />}
                            onClick={priorityHandler(BandwidthPriority.normal, props)}>
                            Normal
                        </Menu.Item>
                        <Menu.Item icon={<Icon.CircleFill color="gold" />}
                            onClick={priorityHandler(BandwidthPriority.low, props)}>
                            Low
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Button.Group>

            <ToolbarButton
                title={`Turn alternative bandwidth mode ${altSpeedMode ? "off" : "on"}`}
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

            <ToolbarButton><Icon.Tools size="1.5rem" /></ToolbarButton>
        </Flex >
    );
}
