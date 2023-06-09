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
import React from "react";

interface ProgressBarProps {
    now: number,
    max?: number,
    label?: string,
    animate?: boolean,
    className?: string,
}

export function ProgressBar(props: ProgressBarProps) {
    const max = props.max ?? 100;
    const percent = Math.round(1000 * props.now / max) / 10;
    const label = props.label ?? `${percent}%`;
    const className = `progressbar ${props.animate === true ? "animate" : ""} ${props.className ?? ""}`;
    return (
        <div className={className}>
            <div>{label}</div>
            <div style={{ clipPath: `inset(0 0 0 ${percent}%)` }}>{label}</div>
        </div>
    );
}
