import { ColorScheme, ColorSchemeProvider, MantineProvider } from "@mantine/core";
import { useColorScheme } from "@mantine/hooks";
import React from "react";
import { useState } from "react";

export function CustomMantineProvider({ children }: { children: React.ReactNode }) {
    const preferredColorScheme = useColorScheme();
    const [colorScheme, setColorScheme] = useState<ColorScheme>(preferredColorScheme);
    const toggleColorScheme = (value?: ColorScheme) =>
        setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));

    return (
        <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
            <MantineProvider withGlobalStyles withNormalizeCSS
                theme={{
                    colorScheme,
                    colors: {
                        secondaryColorName: ['#dcfdff', '#b2f4fd', '#85ebf9', '#58e3f6', '#36d9f3', '#25c0d9', '#1696aa', '#066b7a', '#00404a', '#00171b']
                    }
                }}
            >
                {children}
            </MantineProvider>
        </ColorSchemeProvider>
    );
}
