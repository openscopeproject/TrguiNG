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

import React, { useCallback } from "react";
import { Checkbox, Grid, NumberInput, Textarea, useMantineTheme } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import type { ColorSetting } from "components/colorswatch";
import ColorChooser from "components/colorswatch";
import { useGlobalStyleOverrides } from "themehooks";

export interface InterfaceFormValues {
    interface: {
        skipAddDialog: boolean,
        numLastSaveDirs: number,
        defaultTrackers: string[],
    },
}

export function InterfaceSettigsPanel<V extends InterfaceFormValues>(props: { form: UseFormReturnType<V> }) {
    const theme = useMantineTheme();
    const { color, backgroundColor, setStyle } = useGlobalStyleOverrides();

    const setTextColor = useCallback((color: ColorSetting | undefined) => {
        setStyle({ color, backgroundColor });
    }, [backgroundColor, setStyle]);

    const setBgColor = useCallback((backgroundColor: ColorSetting | undefined) => {
        setStyle({ color, backgroundColor });
    }, [color, setStyle]);

    const defaultColor = theme.colorScheme === "dark"
        ? { color: "dark", shade: 0 }
        : { color: "dark", shade: 9 };

    const defaultBg = theme.colorScheme === "dark"
        ? { color: "dark", shade: 7 }
        : { color: "gray", shade: 0 };

    return (
        <Grid>
            <Grid.Col span={2}>
                Text
            </Grid.Col>
            <Grid.Col span={1}>
                <ColorChooser value={color ?? defaultColor} onChange={setTextColor} />
            </Grid.Col>
            <Grid.Col span={2}>
                Bakground
            </Grid.Col>
            <Grid.Col span={1}>
                <ColorChooser value={backgroundColor ?? defaultBg} onChange={setBgColor} />
            </Grid.Col>
            <Grid.Col span={6} />
            <Grid.Col>
                <Checkbox label="Skip add torrent dialog"
                    {...props.form.getInputProps("interface.skipAddDialog", { type: "checkbox" })} />
            </Grid.Col>
            <Grid.Col span={8}>Max number of saved download directories</Grid.Col>
            <Grid.Col span={2}>
                <NumberInput
                    min={1}
                    max={100}
                    {...props.form.getInputProps("interface.numLastSaveDirs")} />
            </Grid.Col>
            <Grid.Col span={2}></Grid.Col>
            <Grid.Col>
                <Textarea minRows={10}
                    label="Default tracker list"
                    value={props.form.values.interface.defaultTrackers.join("\n")}
                    onChange={(e) => {
                        props.form.setFieldValue(
                            "interface.defaultTrackers", e.currentTarget.value.split("\n") as any);
                    }} />
            </Grid.Col>
        </Grid>
    );
}
