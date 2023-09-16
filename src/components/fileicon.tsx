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

import * as Icon from "react-bootstrap-icons";
import React from "react";
import { useMantineTheme, type DefaultMantineColor } from "@mantine/core";

interface FileType {
    icon: React.FunctionComponent<Icon.IconProps>,
    color: DefaultMantineColor,
    extensions: Readonly<string[]>,
}

const fileTypes: Readonly<FileType[]> = [
    // Video
    {
        icon: Icon.Film,
        extensions: [
            "3gp", "avi", "flv", "m4v", "mkv", "mov", "mp4", "mpeg",
            "mpg", "rm", "swf", "vob", "webm", "wmv"],
        color: "grape",
    },
    // Audio
    {
        icon: Icon.MusicNoteBeamed,
        extensions: ["aac", "aif", "cda", "flac", "m4a", "mid", "midi", "mp3", "mpa", "ogg", "wav", "wma", "wpl"],
        color: "cyan",
    },
    // Image
    {
        icon: Icon.FileEarmarkImage,
        extensions: ["ai", "bmp", "gif", "ico", "jpg", "jpeg", "png", "ps", "psd", "svg", "tif", "tiff", "webp"],
        color: "yellow",
    },
    // Archive
    {
        icon: Icon.FileZip,
        extensions: [
            "7z", "arc", "arj", "bz", "bz2", "cbz", "cbr", "deb", "gz",
            "pkg", "rar", "rpm", "tar", "z", "zip"],
        color: "lime",
    },
    // Binary
    {
        icon: Icon.FileEarmarkBinary,
        extensions: ["exe", "bin", "dmg", "dll", "apk", "jar", "msi", "sys", "cab"],
        color: "red",
    },
    // Text/doc
    {
        icon: Icon.FileEarmarkText,
        extensions: ["doc", "docx", "rtf", "txt", "md", "adoc", "ass", "epub", "mobi", "fb2"],
        color: "gray",
    },
    // Disc image
    {
        icon: Icon.Disc,
        extensions: ["iso", "vcd", "toast", "mdf", "nrg", "img"],
        color: "cyan",
    },
] as const;

const extensions = fileTypes.reduce<Record<string, FileType>>((v, c) => {
    for (const ext of c.extensions) v[ext] = c;
    return v;
}, {});

export function FileIcon({ name, selected }: { name: string, selected: boolean }) {
    const theme = useMantineTheme();

    const ext = name.substring(name.lastIndexOf(".") + 1).toLowerCase();
    const FileIcon = Object.hasOwn(extensions, ext) ? extensions[ext].icon : Icon.FileEarmark;
    const color = Object.hasOwn(extensions, ext) ? extensions[ext].color : "gray";
    const shade = (theme.colorScheme === "dark" || selected) ? 3 : 9;

    return <FileIcon size="1.1rem" color={theme.colors[color][shade]} />;
}
