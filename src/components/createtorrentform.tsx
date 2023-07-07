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

import type { Styles, TextInputStylesNames } from "@mantine/core";
import { Box, Button, Flex, Group, Slider, Text, TextInput, Textarea, useMantineColorScheme } from "@mantine/core";
import { useForm } from "@mantine/form";
import { dialog } from "@tauri-apps/api";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { appVersion } from "./modals/version";
import { ProgressBar } from "./progressbar";
const { appWindow, invoke } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface FormValues {
    path: string,
    name: string,
    pieceLength: number,
    announceList: string[],
    comment: string,
    urlList: string[],
    version: string,
}

const textAreaStyles: Styles<TextInputStylesNames, Record<string, any>> = {
    root: {
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
    },
    wrapper: {
        flexGrow: 1,
    },
    input: {
        height: "100%",
    },
};

const byteLabel = (b: number) => {
    if (b >= 1024 * 1024) return `${b / 1024 / 1024} MB`;
    if (b >= 1024) return `${b / 1024} KB`;
    return `${b} B`;
};

interface PassEventData {
    from: string,
    payload: string,
}

interface CreateCheckResult {
    notFound?: boolean,
    error?: string,
    complete?: string,
    inProgress?: {
        hashed: number,
        total: number,
    },
}

export default function CreateTorrentForm() {
    const { toggleColorScheme } = useMantineColorScheme();
    const [defaultTrackers, setDefaultTrackers] = useState<string[]>([]);
    const [pieces, setPieces] = useState({
        done: 0,
        total: 0,
    });
    const [state, setState] = useState({
        state: "idle",
        error: "",
        hash: "",
    });

    const form = useForm<FormValues>({
        initialValues: {
            path: "",
            name: "",
            pieceLength: 2 ** 18,
            comment: "",
            announceList: [],
            urlList: [],
            version: appVersion.gitVersion,
        },
    });

    useEffect(() => {
        void appWindow.once<PassEventData>("pass-from-window", ({ payload: data }) => {
            console.log("Got from window", data);
            const { colorScheme, defaultTrackers } = JSON.parse(data.payload);
            toggleColorScheme(colorScheme);
            setDefaultTrackers(defaultTrackers);
        });
        void invoke("pass_to_window", { to: "main", payload: "ready" });
    }, [toggleColorScheme]);

    const { setFieldValue } = form;

    const onBrowseFile = useCallback(() => {
        dialog.open({
            title: "Select file",
            defaultPath: form.values.path,
            multiple: false,
        }).then((path) => {
            if (path === null) return;
            setFieldValue("path", path as string);
            const name = (path as string).split(/[\\/]/).pop() ?? "";
            setFieldValue("name", name);
        }).catch(console.error);
    }, [form.values.path, setFieldValue]);

    const onBrowseDirectory = useCallback(() => {
        dialog.open({
            title: "Select directory",
            defaultPath: form.values.path,
            directory: true,
        }).then((path) => {
            if (path === null) return;
            setFieldValue("path", path as string);
            const name = (path as string).split(/[\\/]/).pop() ?? "";
            setFieldValue("name", name);
        }).catch(console.error);
    }, [form.values.path, setFieldValue]);

    const timer = useRef(0);

    const onGenerate = useCallback(() => {
        invoke("create_torrent", { info: form.values }).then(() => {
            clearInterval(timer.current);

            timer.current = window.setInterval(() => {
                invoke<CreateCheckResult>("check_create_torrent").then((result) => {
                    setState({ state: "generating", error: "", hash: "" });
                    console.log("Check result", result);
                    if (result.error !== undefined) {
                        setState({ state: "error", error: result.error, hash: "" });
                        clearInterval(timer.current);
                    }
                    if (result.complete !== undefined) {
                        setState({ state: "done", error: "", hash: result.complete });
                        clearInterval(timer.current);
                    }
                    if (result.notFound !== undefined) {
                        setState({ state: "error", error: "Torrent create request not found on backend", hash: "" });
                        clearInterval(timer.current);
                    }
                    if (result.inProgress !== undefined) {
                        setPieces({ done: result.inProgress.hashed, total: result.inProgress.total });
                    }
                }).catch((error) => {
                    setState({ state: "error", error, hash: "" });
                    clearInterval(timer.current);
                });
            }, 500);
        }).catch((error) => {
            setState({ state: "error", error, hash: "" });
        });
    }, [form.values]);

    const onCancel = useCallback(() => {
        clearInterval(timer.current);
        invoke("cancel_create_torrent").then(() => {
            setState({ state: "idle", error: "", hash: "" });
        }).catch((error) => {
            setState({ state: "error", error, hash: "" });
        });
    }, []);

    const onSave = useCallback(() => {
        dialog.save({
            title: "Save torrent file",
            filters: [{
                name: "Torrent",
                extensions: ["torrent"],
            }],
        }).then((path) => {
            if (path != null) {
                invoke("save_create_torrent", { path }).then(() => {
                    setState({ state: "idle", error: "", hash: "" });
                }).catch((error) => {
                    setState({ state: "error", error, hash: "" });
                });
            }
        }).catch(console.error);
    }, []);

    const addDefaultTrackers = useCallback(() => {
        let list = form.values.announceList;
        list = [...list, ...defaultTrackers];
        form.setFieldValue("announceList", list);
    }, [defaultTrackers, form]);

    return (
        <Flex direction="column" h="100%" w="100%" p="lg" gap="lg">
            <Group align="flex-end">
                <TextInput
                    label={"Select file or folder"}
                    {...form.getInputProps("path")}
                    styles={{ root: { flexGrow: 1 } }} />
                <Button onClick={onBrowseFile}>File</Button>
                <Button onClick={onBrowseDirectory}>Directory</Button>
            </Group>
            <TextInput
                label={"Torrent name"}
                {...form.getInputProps("name")} />
            <Text fz="sm">Piece size</Text>
            <Slider
                pt="2.5rem"
                pb="0.5rem"
                px="1rem"
                scale={(v) => 2 ** v}
                step={1}
                min={14}
                max={28}
                labelAlwaysOn
                label={byteLabel}
                value={Math.log2(form.values.pieceLength)}
                onChange={(value) => { form.setFieldValue("pieceLength", 2 ** value); }} />
            <TextInput
                label={"Comment"}
                {...form.getInputProps("comment")} />
            <Group align="flex-end">
                <Box sx={{ flexGrow: 1 }}>Tracker list, one per line, empty line between tiers</Box>
                <Button onClick={addDefaultTrackers}>Add default list</Button>
            </Group>
            <Textarea
                styles={textAreaStyles}
                value={form.values.announceList.join("\n")}
                onChange={(e) => { form.setFieldValue("announceList", e.target.value.split("\n")); }} />
            <Textarea
                styles={textAreaStyles}
                label="Web seed URLs, one per line"
                value={form.values.urlList.join("\n")}
                onChange={(e) => { form.setFieldValue("urlList", e.target.value.split("\n")); }} />
            <Box h="1.5rem">
                {state.state === "error" &&
                    <Text color="red">{state.error}</Text>}
                {state.state === "generating" &&
                    <ProgressBar
                        now={pieces.done}
                        max={Math.max(pieces.total, 1)}
                        label={`Hashing, done ${pieces.done} of ${pieces.total}`}
                        animate />}
                {state.state === "done" &&
                    <Text>{`Torrent infohash: ${state.hash}`}</Text>}
            </Box>
            <Group position="center">
                {(state.state === "idle" || state.state === "error") &&
                    <Button miw="10rem" onClick={onGenerate}>Generate</Button>}
                {state.state === "generating" &&
                    <Button miw="10rem" onClick={onCancel} color="red">Cancel</Button>}
                {state.state === "done" &&
                    <Button miw="10rem" onClick={onSave} color="green">Save</Button>}
            </Group>
        </Flex>
    );
}
