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

import type { MantineTheme } from "@mantine/core";
import { ActionIcon, Button, Flex, Kbd, Menu, TextInput, useMantineTheme } from "@mantine/core";
import debounce from "lodash-es/debounce";
import React, { forwardRef, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Icon from "react-bootstrap-icons";
import PriorityIcon from "svg/icons/priority.svg";
import type { PriorityNumberType } from "rpc/transmission";
import { BandwidthPriority } from "rpc/transmission";
import { useTorrentAction, useMutateSession, useMutateTorrent } from "queries";
import { notifications } from "@mantine/notifications";
import type { TorrentActionMethodsType } from "rpc/client";
import type { ModalCallbacks } from "./modals/servermodals";
import type { HotkeyHandlers } from "hotkeys";
import { useHotkeysContext } from "hotkeys";
import { useHotkeys } from "@mantine/hooks";
import { modKeyString } from "trutil";
import { useServerSelectedTorrents } from "rpc/torrent";
import { ConfigContext } from "config";
import { useTranslation } from "i18n";

const { saveJsonFile, loadJsonFile } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface ToolbarButtonProps extends React.PropsWithChildren<React.ComponentPropsWithRef<"button">> {
    depressed?: boolean,
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
    { children, depressed, ...other }: ToolbarButtonProps, ref,
) {
    return (
        <Button variant="light" compact h="2.5rem" {...other} ref={ref}
            styles={(theme: MantineTheme) => ({
                root: {
                    backgroundColor: theme.colorScheme === "dark"
                        ? theme.colors.gray[depressed === true ? 8 : 9]
                        : theme.colors.gray[depressed === true ? 3 : 1],
                    transform: depressed === true ? "scale(-1, 1)" : "none",
                    color: theme.colorScheme === "dark"
                        ? theme.colors.gray[3]
                        : theme.colors.gray[8],
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
    altSpeedMode: boolean,
    extra?: React.ReactNode,
    toggleFiltersPanel: () => void,
    toggleDetailsPanel: () => void,
    toggleMainSplit: () => void,
    toggleTabStrip: () => void,
}

function useButtonHandlers(
    props: ToolbarProps,
    altSpeedMode: boolean | undefined,
    setAltSpeedMode: React.Dispatch<boolean | undefined>,
) {
    const serverSelected = useServerSelectedTorrents();
    const actionMutate = useTorrentAction();
    const { mutate: mutateTorrent } = useMutateTorrent();

    const handlers = useMemo(() => {
        const checkSelected = (action?: () => void) => {
            return () => {
                if (serverSelected.size > 0) action?.();
            };
        };
        const action = (method: TorrentActionMethodsType) => () => {
            actionMutate(
                {
                    method,
                    torrentIds: Array.from(serverSelected),
                },
                {
                    onError: (e) => {
                        console.error("Error running torrent update method", method, e);
                        notifications.show({
                            message: "Error updating torrent",
                            color: "red",
                        });
                    },
                },
            );
        };
        const priority = (bandwidthPriority: PriorityNumberType) => () => {
            mutateTorrent(
                {
                    torrentIds: Array.from(serverSelected),
                    fields: { bandwidthPriority },
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
        };

        return {
            start: checkSelected(action("torrent-start")),
            pause: checkSelected(action("torrent-stop")),
            remove: checkSelected(props.modals.current?.remove),
            queueDown: checkSelected(action("queue-move-down")),
            queueUp: checkSelected(action("queue-move-up")),
            move: checkSelected(props.modals.current?.move),
            setLabels: checkSelected(props.modals.current?.setLabels),
            setPriorityHigh: checkSelected(priority(BandwidthPriority.high)),
            setPriorityNormal: checkSelected(priority(BandwidthPriority.normal)),
            setPriorityLow: checkSelected(priority(BandwidthPriority.low)),
            daemonSettings: () => { props.modals.current?.daemonSettings(); },
        };
    }, [actionMutate, mutateTorrent, props.modals, serverSelected]);

    const sessionMutation = useMutateSession();

    const toggleAltSpeedMode = useCallback(() => {
        sessionMutation.mutate({ "alt-speed-enabled": altSpeedMode !== true }, {
            onError: (_, session) => {
                setAltSpeedMode(session["alt-speed-enabled"] !== true);
            },
        });
        setAltSpeedMode(altSpeedMode !== true);
    }, [altSpeedMode, sessionMutation, setAltSpeedMode]);

    const hk = useHotkeysContext();

    useEffect(() => {
        hk.handlers = { ...hk.handlers, ...handlers };
        return () => {
            Object.keys(handlers).forEach((k) => { hk.handlers[k as keyof HotkeyHandlers] = () => { }; });
        };
    }, [hk, handlers]);

    return {
        ...handlers,
        toggleAltSpeedMode,
    };
}

function Toolbar(props: ToolbarProps) {
    const config = useContext(ConfigContext);
    const { t } = useTranslation();

    const debouncedSetSearchTerms = useMemo(
        () => debounce(props.setSearchTerms, 500, { trailing: true, leading: false }),
        [props.setSearchTerms]);

    const [altSpeedMode, setAltSpeedMode] = useState<boolean>();

    useEffect(() => {
        if (props.altSpeedMode !== undefined) setAltSpeedMode(props.altSpeedMode);
    }, [props.altSpeedMode]);

    const onSearchInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
        debouncedSetSearchTerms(
            e.currentTarget.value
                .split(" ")
                .map((s) => s.trim().toLowerCase())
                .filter((s) => s !== ""));
    }, [debouncedSetSearchTerms]);

    const [searchPlaceholder, setSearchPlaceholder] = useState<string>(`${t("toolbar.search")} (${modKeyString()} + f)`);

    const searchRef = useRef<HTMLInputElement>(null);

    const onSearchClear = useCallback(() => {
        if (searchRef.current != null) searchRef.current.value = "";
        props.setSearchTerms([]);
    }, [props]);

    const theme = useMantineTheme();
    const handlers = useButtonHandlers(props, altSpeedMode, setAltSpeedMode);

    const hk = useHotkeysContext();

    useEffect(() => {
        hk.handlers.focusSearch = () => searchRef.current?.focus();
        return () => { hk.handlers.focusSearch = () => { }; };
    }, [hk]);

    useHotkeys([
        ["mod + P", props.toggleMainSplit],
        ["mod + O", props.toggleFiltersPanel],
        ["mod + I", props.toggleDetailsPanel],
        ["mod + [", props.toggleTabStrip],
    ]);

    const onSettingsExport = useCallback(() => {
        void saveJsonFile(config.getExportedInterfaceSettings(), "trguing-interface.json");
    }, [config]);

    const onSettingsImport = useCallback(async () => {
        try {
            const settings = await loadJsonFile();
            await config.tryMergeInterfaceSettings(JSON.parse(settings));
            window.location.reload();
        } catch (e) {
            let msg = "";
            if (typeof e === "string") {
                msg = e;
            } else if (e instanceof Error) {
                msg = e.message;
            }
            notifications.show({
                title: "Error importing settings",
                message: msg,
                color: "red",
            });
        }
    }, [config]);

    return (
        <Flex w="100%" align="stretch">
            <Button.Group mx="sm">
                <ToolbarButton
                    title={t("toolbar.addTorrent")}
                    onClick={() => { props.modals.current?.addTorrent(); }}>
                    <Icon.FileArrowDownFill size="1.5rem" color={theme.colors.green[8]} />
                </ToolbarButton>
                <ToolbarButton
                    title={t("toolbar.addMagnet")}
                    onClick={() => { props.modals.current?.addMagnet(); }}>
                    <Icon.MagnetFill size="1.5rem" color={theme.colors.green[8]} />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton
                    title={`${t("toolbar.start")} (F3)`}
                    onClick={handlers.start} >
                    <Icon.PlayCircleFill size="1.5rem" color={theme.colors.blue[6]} />
                </ToolbarButton>
                <ToolbarButton
                    title={`${t("toolbar.pause")} (F4)`}
                    onClick={handlers.pause} >
                    <Icon.PauseCircleFill size="1.5rem" color={theme.colors.blue[6]} />
                </ToolbarButton>
                <ToolbarButton
                    title={`${t("toolbar.remove")} (del)`}
                    onClick={handlers.remove}>
                    <Icon.XCircleFill size="1.5rem" color={theme.colors.red[6]} />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton
                    title={t("toolbar.queueUp")}
                    onClick={handlers.queueUp} >
                    <Icon.ArrowUpCircleFill size="1.5rem" color={theme.colors.green[8]} />
                </ToolbarButton>
                <ToolbarButton
                    title={t("toolbar.queueDown")}
                    onClick={handlers.queueDown} >
                    <Icon.ArrowDownCircleFill size="1.5rem" color={theme.colors.green[8]} />
                </ToolbarButton>
            </Button.Group>

            <Button.Group mx="sm">
                <ToolbarButton
                    title={`${t("toolbar.move")} (F6)`}
                    onClick={handlers.move}>
                    <Icon.FolderFill size="1.5rem" color={theme.colors.yellow[4]} stroke={theme.colors.yellow[5]} />
                </ToolbarButton>
                <ToolbarButton
                    title={`${t("toolbar.setLabels")} (F7)`}
                    onClick={handlers.setLabels} >
                    <Icon.TagsFill size="1.5rem" color={theme.colors.blue[6]} />
                </ToolbarButton>

                <Menu shadow="md" width="10rem" withinPortal returnFocus middlewares={{ shift: true, flip: false }}>
                    <Menu.Target>
                        <ToolbarButton title={t("toolbar.setPriority")}>
                            <PriorityIcon width="1.5rem" height="1.5rem"
                                fill={theme.colors.yellow[theme.colorScheme === "dark" ? 4 : 6]} />
                        </ToolbarButton>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <Menu.Item icon={<Icon.CircleFill color={theme.colors.orange[7]} />}
                            onClick={handlers.setPriorityHigh} rightSection={<Kbd>{`${modKeyString()} H`}</Kbd>}>
                            {t("toolbar.priorityHigh")}
                        </Menu.Item>
                        <Menu.Item icon={<Icon.CircleFill color={theme.colors.teal[9]} />}
                            onClick={handlers.setPriorityNormal} rightSection={<Kbd>{`${modKeyString()} N`}</Kbd>}>
                            {t("toolbar.priorityNormal")}
                        </Menu.Item>
                        <Menu.Item icon={<Icon.CircleFill color={theme.colors.yellow[6]} />}
                            onClick={handlers.setPriorityLow} rightSection={<Kbd>{`${modKeyString()} L`}</Kbd>}>
                            {t("toolbar.priorityLow")}
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Button.Group>

            <ToolbarButton
                title={`${altSpeedMode === true ? t("toolbar.altSpeedModeOff") : t("toolbar.altSpeedModeOn")} (F8)`}
                onClick={handlers.toggleAltSpeedMode}
                depressed={altSpeedMode}
            >
                <Icon.Speedometer2 size="1.5rem" />
            </ToolbarButton>

            <TextInput mx="sm" ref={searchRef}
                icon={<Icon.Search size="1rem" />}
                placeholder={searchPlaceholder}
                rightSection={<ActionIcon onClick={onSearchClear} title={t("toolbar.clear")}>
                    <Icon.XLg size="1rem" color={theme.colors.red[6]} />
                </ActionIcon>}
                onInput={onSearchInput}
                onFocus={() => setSearchPlaceholder(t("toolbar.searchPlaceholder"))}
                onBlur={() => setSearchPlaceholder(`${t("toolbar.search")} (${modKeyString()} + f)`)}
                styles={{ root: { flexGrow: 1 }, input: { height: "auto" } }}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
            />

            <Menu shadow="md" width="12rem" withinPortal returnFocus middlewares={{ shift: true, flip: true }}>
                <Menu.Target>
                    <ToolbarButton title={t("toolbar.layout")}>
                        <Icon.Grid1x2Fill size="1.5rem" style={{ transform: "rotate(-90deg)" }} />
                    </ToolbarButton>
                </Menu.Target>

                <Menu.Dropdown>
                    <Menu.Item
                        onClick={props.toggleMainSplit} rightSection={<Kbd>{`${modKeyString()} P`}</Kbd>}>
                        {t("toolbar.changeLayout")}
                    </Menu.Item>
                    <Menu.Item
                        onClick={props.toggleFiltersPanel} rightSection={<Kbd>{`${modKeyString()} O`}</Kbd>}>
                        {t("toolbar.toggleFilters")}
                    </Menu.Item>
                    <Menu.Item
                        onClick={props.toggleDetailsPanel} rightSection={<Kbd>{`${modKeyString()} I`}</Kbd>}>
                        {t("toolbar.toggleDetails")}
                    </Menu.Item>
                    {props.extra !== undefined &&
                        <Menu.Item
                            onClick={props.toggleTabStrip} rightSection={<Kbd>{`${modKeyString()} [`}</Kbd>}>
                            {t("toolbar.toggleTabStrip")}
                        </Menu.Item>}
                    <Menu.Divider />
                    <Menu.Label>{t("toolbar.interfaceSettings")}</Menu.Label>
                    <Menu.Item onClick={onSettingsExport}>
                        {t("toolbar.export")}
                    </Menu.Item>
                    <Menu.Item onClick={() => { void onSettingsImport(); }}>
                        {t("toolbar.import")}
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>

            <ToolbarButton
                title={`${t("toolbar.daemonSettings")} (F9)`}
                onClick={handlers.daemonSettings}>
                <Icon.Tools size="1.5rem" />
            </ToolbarButton>

            {props.extra}
        </Flex>
    );
}

export const MemoizedToolbar = memo(Toolbar) as typeof Toolbar;
