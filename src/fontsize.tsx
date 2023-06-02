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

import { useToggle } from "@mantine/hooks";
import { ConfigContext } from "config";
import React, { useContext, useEffect, useMemo } from "react";

interface FontsizeContextValue {
    value: number,
    toggle: (v?: React.SetStateAction<number>) => void,
}

const FontsizeContext = React.createContext<FontsizeContextValue>(
    { value: 0.9, toggle: (v?: React.SetStateAction<number>) => { } });

export function FontsizeContextProvider(props: React.PropsWithChildren) {
    const config = useContext(ConfigContext);
    const sizeValues = useMemo(() => {
        const base = config.values.app.fontSizeBase;
        const eps = 1e-6;
        const increment = 10.0 / 9.0; // 1.1111111
        let value = Math.max(config.values.app.fontSize, base / increment / increment);
        const result: number[] = [];
        while (result.length < 5 && value < base * increment * increment + eps) {
            result.push(value);
            value *= increment;
        }
        value = base / increment / increment;
        while (result.length < 5 && value < base * increment * increment + eps) {
            result.push(value);
            value *= increment;
        }
        return result;
    }, [config]);
    const [fontSize, toggle] = useToggle(sizeValues);

    useEffect(() => {
        toggle(config.values.app.fontSize);
    }, [config, toggle]);

    useEffect(() => {
        config.values.app.fontSize = fontSize;
    }, [config, fontSize]);

    return (
        <FontsizeContext.Provider value={{ value: fontSize, toggle }}>
            {props.children}
        </FontsizeContext.Provider>
    );
}

export function useFontSize() {
    return useContext(FontsizeContext);
}
