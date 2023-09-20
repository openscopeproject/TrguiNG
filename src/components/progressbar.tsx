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

import "../css/progressbar.css";
import React, { useContext } from "react";
import { ConfigContext } from "../config";

interface ProgressBarProps {
    now: number,
    max?: number,
    label?: string,
    animate?: boolean,
    status?: string,
    className?: string,
}

export function ProgressBar(props: ProgressBarProps) {
    const max = props.max ?? 100;
    const percent = Math.floor(1000 * props.now / max) / 10;
    const label = props.label || `${percent}%`;
    const animate = (props.animate && props.status !== "Waiting") || props.status == "Magnetizing" || props.status == "Verifying";
    let color = "blue";
    let dark = false;

    const config = useContext(ConfigContext);
    const colorize = config.values.interface.colorfulProgressBars;
    if (colorize) {
        dark = props.status == "Stopped" || props.status == "Waiting" || props.status == "Error";
        if (props.status == "Magnetizing" || props.status == "Error") {
            color = "red";
        } else if (props.status == "Seeding" || (percent == 100 && props.status !== "Waiting" && props.status !== "Verifying")) {
            color = "green";
        }
    }

    const className = `progressbar ${animate === true ? "animate" : ""} ${dark === true ? "dark" : ""} ${color} ${props.className ?? ""}`;
    return (
        <div className={className}>
            <div>{label}</div>
            <div style={{ clipPath: `inset(0 0 0 ${percent}%)` }}>{label}</div>
        </div>
    );
}
