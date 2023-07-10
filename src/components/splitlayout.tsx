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

import { Box } from "@mantine/core";
import type { SplitType } from "config";
import { ConfigContext } from "config";
import React, { useCallback, useContext } from "react";
import Split from "react-split";

interface SplitLayoutProps {
    mainSplit: SplitType,
    left: React.ReactNode | undefined,
    right: React.ReactNode,
    bottom: React.ReactNode | undefined,
}

// The left is filters, right is torrents, bottom is details.
// Depending on mainSplit it may actually be "left", "midle", "right".
export function SplitLayout({ mainSplit, left, right, bottom }: SplitLayoutProps) {
    const config = useContext(ConfigContext);

    const onVerticalDragEnd = useCallback((sizes: [number, number]) => {
        config.setSashSizes("vertical", sizes);
    }, [config]);
    const onHorizontalDragEnd = useCallback((sizes: [number, number]) => {
        config.setSashSizes("horizontal", sizes);
    }, [config]);

    const top = left === undefined
        ? right
        : <Split
            direction="horizontal"
            sizes={config.getSashSizes("horizontal")}
            snapOffset={0}
            gutterSize={6}
            className="split-horizontal"
            onDragEnd={onHorizontalDragEnd}
        >
            {left}
            {right}
        </Split>;

    return (
        <Box sx={(theme) => ({
            flexGrow: 1,
            "& .gutter": {
                backgroundColor: theme.colorScheme === "dark" ? theme.colors.gray[7] : theme.colors.gray[3],
            },
        })} >
            {bottom === undefined
                ? top
                : <Split
                    direction={mainSplit}
                    sizes={config.getSashSizes("vertical")}
                    snapOffset={0}
                    gutterSize={6}
                    className={`split-${mainSplit}`}
                    onDragEnd={onVerticalDragEnd}
                >
                    {top}
                    {bottom}
                </Split>}
        </Box>
    );
}
