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

import "css/mantineoverrides.css";

import { MantineProvider, createTheme, useComputedColorScheme, useMantineColorScheme, useMantineTheme } from "@mantine/core";
import type { MantineThemeOverride } from "@mantine/core";
import { ConfigContext } from "config";
import { FontsizeContextProvider, GlobalStyleOverridesContext, useFontSize, useGlobalStyleOverrides } from "themehooks";
import React, { useContext, useEffect, useMemo, useState } from "react";

const Theme: (font?: string) => MantineThemeOverride = (font) => createTheme({
    fontFamily: font ?? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    headings: {
        fontFamily: font ?? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    },
    colors: {
        turquoise: ["#dcfdff", "#b2f4fd", "#85ebf9", "#58e3f6", "#36d9f3", "#25c0d9", "#1696aa", "#066b7a", "#00404a", "#00171b"],
    },
    spacing: {
        xs: "0.3rem",
        sm: "0.4rem",
        md: "0.5rem",
        lg: "0.7rem",
        xl: "1rem",
    },
});

function GlobalStyles() {
    const theme = useMantineTheme();
    const colorScheme = useComputedColorScheme();
    const fontSize = useFontSize();
    const { style } = useGlobalStyleOverrides();
    const overrides = style[colorScheme];

    const bodyColor = overrides.color === undefined
        ? undefined
        : theme.colors[overrides.color.color][overrides.color.shade];

    const bodyBgColor = overrides.backgroundColor === undefined
        ? undefined
        : theme.colors[overrides.backgroundColor.color][overrides.backgroundColor.shade];

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty("--font-size", `${fontSize.value}em`);
        root.style.setProperty("--body-color", bodyColor ?? "var(--mantine-color-text)");
        root.style.setProperty("--body-bg-color", bodyBgColor ?? "var(--mantine-color-body)");
    }, [fontSize.value, bodyColor, bodyBgColor]);

    return null;
}

function ColorSchemeSync() {
    const { colorScheme } = useMantineColorScheme();
    const config = useContext(ConfigContext);

    useEffect(() => {
        config.setTheme(colorScheme);
    }, [colorScheme, config]);

    return null;
}

export default function CustomMantineProvider({ children }: { children: React.ReactNode }) {
    const config = useContext(ConfigContext);
    const [style, setStyle] = useState(config.values.interface.styleOverrides);

    useEffect(() => {
        config.values.interface.styleOverrides = style;
    }, [config, style]);

    const theme = useMemo(() => {
        return Theme(style.font);
    }, [style.font]);

    return (
        <FontsizeContextProvider>
            <GlobalStyleOverridesContext.Provider value={{ style, setStyle }}>
                <MantineProvider theme={theme} defaultColorScheme={config.getTheme()}>
                    <ColorSchemeSync />
                    <GlobalStyles />
                    {children}
                </MantineProvider>
            </GlobalStyleOverridesContext.Provider>
        </FontsizeContextProvider>
    );
}
