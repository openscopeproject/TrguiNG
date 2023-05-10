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

import { Button, Menu, type MenuProps, Portal, ScrollArea } from "@mantine/core";
import React, { useCallback, useEffect, useState } from "react";

interface ContextMenuInfo {
    x: number,
    y: number,
    opened: boolean,
}

export function useContextMenu(): [ContextMenuInfo, React.Dispatch<ContextMenuInfo>, React.MouseEventHandler<HTMLElement>] {
    const [info, setInfo] = useState<ContextMenuInfo>({ x: 0, y: 0, opened: false });

    const contextMenuHandler = useCallback<React.MouseEventHandler<HTMLElement>>((e) => {
        e.preventDefault();
        setInfo({ x: e.clientX, y: e.clientY, opened: true });
    }, [setInfo]);

    return [info, setInfo, contextMenuHandler];
}

interface ContextMenuProps extends MenuProps {
    contextMenuInfo: ContextMenuInfo,
    setContextMenuInfo: (i: ContextMenuInfo) => void,
}

export function ContextMenu({ contextMenuInfo, setContextMenuInfo, children, ...other }: ContextMenuProps) {
    const onClose = useCallback(
        () => { setContextMenuInfo({ ...contextMenuInfo, opened: false }); },
        [contextMenuInfo, setContextMenuInfo]);

    const [opened, setOpened] = useState<boolean>(false);

    useEffect(() => { setOpened(contextMenuInfo.opened); }, [contextMenuInfo.opened]);

    return (
        <Menu {...other}
            opened={opened}
            onClose={onClose}
            offset={0}
            middlewares={{ shift: true, flip: false }}
            position="right-start"
        >
            <Portal>
                <Menu.Target>
                    <Button unstyled
                        sx={{
                            position: "absolute",
                            width: 0,
                            height: 0,
                            padding: 0,
                            border: 0,
                        }}
                        style={{
                            left: contextMenuInfo.x,
                            top: contextMenuInfo.y,
                        }} />
                </Menu.Target>
                <Menu.Dropdown>
                    <ScrollArea.Autosize
                        type="auto"
                        mah={"calc(100% - 0.5rem)"}
                        offsetScrollbars
                        styles={{
                            viewport: {
                                paddingBottom: 0
                            }
                        }}
                    >
                        {children}
                    </ScrollArea.Autosize>
                </Menu.Dropdown>
            </Portal>
        </Menu>
    );
}
