import { ColorScheme, ColorSchemeProvider, MantineProvider, MantineThemeOverride } from "@mantine/core";
import { useColorScheme } from "@mantine/hooks";
import React from "react";
import { useState } from "react";

const Theme: (colorScheme: ColorScheme) => MantineThemeOverride = (colorScheme) => ({
    colorScheme,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    headings: {
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    },
    components: {
        Table: {
            styles: {
                root: {
                    "& tbody tr td": {
                        padding: "0 0.5rem"
                    }
                }
            }
        },
    },
    colors: {
        secondaryColorName: ['#dcfdff', '#b2f4fd', '#85ebf9', '#58e3f6', '#36d9f3', '#25c0d9', '#1696aa', '#066b7a', '#00404a', '#00171b']
    },
    spacing: {
        xs: '0.3rem',
        sm: '0.4rem',
        md: '0.5rem',
        lg: '0.7rem',
        xl: '1rem',
    },
});

export function CustomMantineProvider({ children }: { children: React.ReactNode }) {
    const preferredColorScheme = useColorScheme();
    const [colorScheme, setColorScheme] = useState<ColorScheme>(preferredColorScheme);
    const toggleColorScheme = (value?: ColorScheme) =>
        setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));

    return (
        <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
            <MantineProvider withGlobalStyles withNormalizeCSS theme={Theme(colorScheme)}>
                {children}
            </MantineProvider>
        </ColorSchemeProvider>
    );
}
