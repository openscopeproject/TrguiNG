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

import { useHotkeys } from "@mantine/hooks";
import React, { useContext } from "react";

export interface HotkeyHandlers {
    start: () => void,
    pause: () => void,
    remove: () => void,
    move: () => void,
    setLabels: () => void,
    setPriorityHigh: () => void,
    setPriorityNormal: () => void,
    setPriorityLow: () => void,
    toggleAltSpeedMode: () => void,
    daemonSettings: () => void,
    selectAll: () => void,
    focusSearch: () => void,
}

const Hotkeys: {
    active: boolean,
    handlers: HotkeyHandlers,
    run: (handler: keyof HotkeyHandlers) => void,
} = {
    active: true,
    handlers: {
        start: () => { },
        pause: () => { },
        remove: () => { },
        move: () => { },
        setLabels: () => { },
        setPriorityHigh: () => { },
        setPriorityNormal: () => { },
        setPriorityLow: () => { },
        toggleAltSpeedMode: () => { },
        daemonSettings: () => { },
        selectAll: () => { },
        focusSearch: () => { },
    },
    run(handler) {
        if (this.active) this.handlers[handler]();
    },
};

export const HotkeysContext = React.createContext(Hotkeys);
export function useHotkeysContext() {
    return useContext(HotkeysContext);
}

export function useAppHotkeys() {
    const hk = useHotkeysContext();

    useHotkeys([
        ["F3", () => { hk.run("start"); }],
        ["F4", () => { hk.run("pause"); }],
        ["delete", () => { hk.run("remove"); }],
        ["F6", () => { hk.run("move"); }],
        ["F7", () => { hk.run("setLabels"); }],
        ["mod + H", () => { hk.run("setPriorityHigh"); }],
        ["mod + N", () => { hk.run("setPriorityNormal"); }],
        ["mod + L", () => { hk.run("setPriorityLow"); }],
        ["F8", () => { hk.run("toggleAltSpeedMode"); }],
        ["F9", () => { hk.run("daemonSettings"); }],
        ["mod + A", () => { hk.run("selectAll"); }],
        ["mod + F", () => { hk.run("focusSearch"); }],
    ]);
}
