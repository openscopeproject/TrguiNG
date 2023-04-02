import { Button, Menu, MenuProps, Portal, ScrollArea } from "@mantine/core";
import React, { useCallback, useEffect, useState } from "react";

interface ContextMenuInfo {
    x: number,
    y: number,
    opened: boolean,
}

export function useContextMenu():
    [ContextMenuInfo, React.Dispatch<ContextMenuInfo>, React.MouseEventHandler<HTMLElement>] {
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
        () => setContextMenuInfo({ ...contextMenuInfo, opened: false }),
        [contextMenuInfo, setContextMenuInfo]);

    const [opened, setOpened] = useState<boolean>(false);

    useEffect(() => setOpened(contextMenuInfo.opened), [contextMenuInfo.opened]);

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
                        mah={`calc(${window.visualViewport!.height}px - 0.5rem)`}
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
