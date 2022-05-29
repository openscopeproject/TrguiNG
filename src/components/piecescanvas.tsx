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

import React from "react";
import { CSSProperties, useEffect, useMemo, useRef } from "react";
import { useResizeDetector } from "react-resize-detector";
import { Torrent } from "../rpc/torrent";

export function PiecesCanvas(props: { torrent: Torrent }) {
    const { width, height, ref } = useResizeDetector({
        refreshMode: "throttle",
        refreshRate: 1000,
    });

    const piecesRef = useRef<HTMLCanvasElement>(null);
    const gridRef = useRef<HTMLCanvasElement>(null);

    const wantedPieces = useMemo(() => {
        var result: Array<boolean> = new Array(props.torrent.pieceCount);

        const pieceSize = props.torrent.pieceSize;
        const lengths = props.torrent.files.map((f: any) => f.length);
        const wanted = props.torrent.fileStats.map((f: any) => f.wanted);

        var fileIndex = 0;
        var pieceIndex = 0;
        var totalLength = 0;

        while (totalLength < props.torrent.totalSize) {
            totalLength += lengths[fileIndex];
            while ((pieceIndex + 1) * pieceSize < totalLength) {
                result[pieceIndex] = result[pieceIndex] || wanted[fileIndex];
                pieceIndex++;
            }
            result[pieceIndex] = result[pieceIndex] || wanted[fileIndex];
            if ((pieceIndex + 1) * pieceSize == totalLength) pieceIndex++;
            fileIndex++;
        }

        return result;
    }, [props.torrent]);

    const [pieceSize, rows, cols] = useMemo(() => {
        if (width === undefined || height === undefined) return [5, 1, 1];

        const check = (size: number) => {
            var cols = Math.floor(width / size);
            var rows = Math.ceil(props.torrent.pieceCount / cols);
            if (rows * size < height) return [rows, cols];
            else return [-1, -1];
        }
        var right = 20;
        var left = 0.0;
        var mid = 10;
        var rows = 1;
        var cols = 1;

        while (right - left > 0.2) {
            [rows, cols] = check(mid);
            if (rows < 0) right = mid;
            else left = mid;
            mid = (right + left) * 0.5;
        }
        return [left, ...check(left)];
    }, [props.torrent.pieceCount, width, height]);

    const pieces = useMemo(() => {
        const bstr = window.atob(props.torrent.pieces);
        var bytes = new Uint8Array(bstr.length);
        for (var i = 0; i < bstr.length; i++) {
            bytes[i] = bstr.charCodeAt(i);
        }
        return bytes;
    }, [props]);

    useEffect(() => {
        var canvas = gridRef.current!;
        var ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const remainder = rows * cols - props.torrent.pieceCount;

        ctx.beginPath();
        ctx.lineWidth = pieceSize > 5 ? 1 : 0.5;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        for (var i = 0; i < rows; i++) {
            ctx.moveTo(0, i * pieceSize);
            ctx.lineTo(cols * pieceSize, i * pieceSize);
        }
        ctx.moveTo(0, rows * pieceSize);
        ctx.lineTo((cols - remainder) * pieceSize, i * pieceSize);
        for (var i = 0; i <= cols - remainder; i++) {
            ctx.moveTo(i * pieceSize, 0);
            ctx.lineTo(i * pieceSize, rows * pieceSize);
        }
        for (var i = cols - remainder + 1; i <= cols; i++) {
            ctx.moveTo(i * pieceSize, 0);
            ctx.lineTo(i * pieceSize, (rows - 1) * pieceSize);
        }
        ctx.stroke();
    }, [gridRef, rows, cols, width, height]);

    useEffect(() => {
        const canvas = piecesRef.current!;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var r = 0; r < rows; r++) {
            var index = 0;
            for (var c = 0; c < cols; c++) {
                index = r * cols + c;
                if (index >= props.torrent.pieceCount) break;
                var have = pieces[Math.floor(index / 8)] & (0b10000000 >> (index % 8));
                ctx.fillStyle = have ? "steelblue" : wantedPieces[index] ? "paleturquoise" : "silver";
                ctx.fillRect(c * pieceSize, r * pieceSize, pieceSize, pieceSize);
            }
            if (index >= props.torrent.pieceCount) break;
        }

    }, [piecesRef, rows, cols, pieceSize, pieces, wantedPieces]);

    const dw = Math.floor(window.devicePixelRatio * (width || 1));
    const dh = Math.floor(window.devicePixelRatio * (height || 1));
    const style: CSSProperties = {
        width: width || 1, height: height || 1, position: "absolute", top: 0, left: 0
    };
    return (
        <div ref={ref} className="w-100 h-100 position-relative" style={{ overflow: "hidden" }}>
            <canvas ref={piecesRef} width={dw} height={dh} style={style} />
            <canvas ref={gridRef} width={dw} height={dh} style={style} />
        </div>
    )
}