import type { DefaultMantineColor, MantineColorsTuple } from "@mantine/core";

type ExtendedCustomColors = "primaryColorName" | "turquoise" | DefaultMantineColor;

declare module "@mantine/core" {
    export interface MantineThemeColorsOverride {
        colors: Record<ExtendedCustomColors, MantineColorsTuple>,
    }
}
