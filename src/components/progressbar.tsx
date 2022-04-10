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
    const max = props.max || 100;
    const percent = Math.round(1000 * props.now / max) / 10;
    const label = props.label || `${percent}%`;
    const className = `progressbar ${props.animate ? "animate" : ""} ${props.className || ""}`;
    return (
        <div className={className}>
            <div>{label}</div>
            <div style={{clipPath: `inset(0 0 0 ${percent}%)`}}>{label}</div>
        </div>
    );
}
