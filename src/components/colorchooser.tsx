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

import { ActionIcon, ColorSwatch, Popover, useMantineTheme, Group, Button } from "@mantine/core";
import type { ColorSetting } from "config";
import React, { useState } from "react";

interface ColorChooserProps {
    value: ColorSetting,
    onChange: (value: ColorSetting | undefined) => void,
}

const shades = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function ColorChooser(props: ColorChooserProps) {
    const theme = useMantineTheme();
    const [opened, setOpened] = useState(false);

    return (
        <Popover
            width="20rem"
            position="right-start"
            withArrow
            transitionProps={{ duration: 0 }}
            shadow="md"
            opened={opened}
            onChange={setOpened}
        >
            <Popover.Target>
                <ActionIcon variant="subtle" onClick={() => { setOpened((o) => !o); }}>
                    <ColorSwatch
                        color={theme.colors[props.value.color][props.value.shade]}
                    />
                </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
                <Button
                    variant="subtle"
                    p="lg"
                    onClick={() => {
                        props.onChange(undefined);
                        setOpened(false);
                    }}
                >
                    Reset
                </Button>
                {Object.keys(theme.colors).map((color) =>
                    <Group key={color} wrap="nowrap" gap="0">
                        {shades.map((shade) =>
                            <ActionIcon
                                key={shade}
                                m="0.1rem"
                                variant="subtle"
                                onClick={() => {
                                    props.onChange({ color, shade, computed: theme.colors[color][shade] });
                                    setOpened(false);
                                }}
                            >
                                <ColorSwatch color={theme.colors[color][shade]} />
                            </ActionIcon>)}
                    </Group>)}
            </Popover.Dropdown>
        </Popover>
    );
}
