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
import { Box, Button, Checkbox, Flex, Group, Slider, Text, TextInput, Textarea, useMantineColorScheme } from "@mantine/core";
import { useForm } from "@mantine/form";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { appVersion } from "./modals/version";
import { ProgressBar } from "./progressbar";
import { bytesToHumanReadableStr } from "trutil";
const { appWindow, invoke, dialogOpen, dialogSave } = await import(/* webpackChunkName: "taurishim" */"taurishim");

interface FormValues {
    path: string,
    name: string,
    pieceLength: number,
    announceList: string[],
    comment: string,
    source: string,
    private: boolean,
    urlList: string[],
    version: string,
}

const textAreaStyles: Styles<TextInputStylesNames, Record<string, unknown>> = {
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

interface GetFileStatsResult {
    files: number,
    size: number,
}

interface InfobarState {
    state: "idle" | "calculating" | "sizes" | "error" | "generating" | "done",
    sizes?: GetFileStatsResult,
    error: string,
    hash: string,
}

export default function CreateTorrentForm() {
    const { toggleColorScheme } = useMantineColorScheme();
    const [defaultTrackers, setDefaultTrackers] = useState<string[]>([]);
    const [pieces, setPieces] = useState({
        done: 0,
        total: 0,
    });
    const [state, setState] = useState<InfobarState>({
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
            source: "",
            private: false,
            announceList: [],
            urlList: [],
            version: appVersion.gitVersion,
        },
    });

    useEffect(() => {
        void appWindow.once<PassEventData>("pass-from-window", ({ payload: data }) => {
            const { colorScheme, defaultTrackers } = JSON.parse(data.payload);
            toggleColorScheme(colorScheme);
            setDefaultTrackers(defaultTrackers);
        });
        void invoke("pass_to_window", { to: "main", payload: "ready" });
    }, [toggleColorScheme]);

    const { setFieldValue } = form;

    const setPathAndCalculate = useCallback((path: string[] | string | null) => {
        if (typeof path !== "string") return;
        setFieldValue("path", path);
        const name = path.split(/[\\/]/).pop() ?? "";
        setFieldValue("name", name);
        setState({
            state: "calculating",
            error: "",
            hash: "",
        });
        invoke<GetFileStatsResult>("get_file_stats", { path }).then((sizes) => {
            if (sizes.files === -1) {
                setState({
                    state: "error",
                    error: "Failed to calculate file sizes",
                    hash: "",
                });
                return;
            }
            setState({
                state: "sizes",
                sizes,
                error: "",
                hash: "",
            });
            // suggest appropriate piece size
            let pieceLength = Math.ceil(Math.log2(sizes.size / 2000));
            if (pieceLength < 18) pieceLength = 18; // at least 256KB
            if (pieceLength > 24) pieceLength = 24; // at most 16MB
            setFieldValue("pieceLength", 2 ** pieceLength);
        }).catch((error) => {
            setState({ state: "error", error, hash: "" });
            clearInterval(timer.current);
        });
    }, [setFieldValue]);

    const onBrowseFile = useCallback(() => {
        dialogOpen({
            title: "Select file",
            defaultPath: form.values.path === "" ? undefined : form.values.path,
            multiple: false,
        }).then(setPathAndCalculate).catch(console.error);
    }, [form.values.path, setPathAndCalculate]);

    const onBrowseDirectory = useCallback(() => {
        dialogOpen({
            title: "Select directory",
            defaultPath: form.values.path === "" ? undefined : form.values.path,
            directory: true,
        }).then(setPathAndCalculate).catch(console.error);
    }, [form.values.path, setPathAndCalculate]);

    const timer = useRef(0);

    const onGenerate = useCallback(() => {
        invoke("create_torrent", { info: form.values }).then(() => {
            clearInterval(timer.current);

            timer.current = window.setInterval(() => {
                invoke<CreateCheckResult>("check_create_torrent").then((result) => {
                    setState({ state: "generating", error: "", hash: "" });
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
        dialogSave({
            title: "Save torrent file",
            defaultPath: form.values.name,
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
    }, [form.values.name]);

    const addDefaultTrackers = useCallback(() => {
        let list = form.values.announceList;
        list = [...list, ...defaultTrackers];
        form.setFieldValue("announceList", list);
    }, [defaultTrackers, form]);

    const browseDisabled = ["calculating", "generating"].includes(state.state);

    return (
        <Flex direction="column" h="100%" w="100%" p="lg" gap="lg">
            <Group align="flex-end">
                <TextInput
                    label={"Select file or directory"}
                    {...form.getInputProps("path")}
                    styles={{ root: { flexGrow: 1 } }}
                    readOnly
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" />
                <Button onClick={onBrowseFile} disabled={browseDisabled}>File</Button>
                <Button onClick={onBrowseDirectory} disabled={browseDisabled}>Directory</Button>
            </Group>
            <TextInput
                label={"Torrent name"}
                {...form.getInputProps("name")}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" />
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
            <TextInput
                label={"Source (leave empty unless required by a private tracker)"}
                {...form.getInputProps("source")}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" />
            <Checkbox
                label="Private torrent"
                {...form.getInputProps("private", { type: "checkbox" })} />
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
                {state.state === "calculating" &&
                    <Text>Calculating sizes...</Text>}
                {state.state === "sizes" &&
                    <Text>
                        {`${state.sizes?.files ?? 1} file${(state.sizes?.files ?? 1) > 1 ? "s" : ""}, `}
                        {`${bytesToHumanReadableStr(state.sizes?.size ?? 0)}, `}
                        {`${Math.ceil((state.sizes?.size ?? 0) / form.values.pieceLength)} pieces`}
                    </Text>}
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
                {(["idle", "error", "calculating", "sizes"].includes(state.state)) &&
                    <Button miw="10rem" onClick={onGenerate} disabled={state.state === "calculating"}>Generate</Button>}
                {state.state === "generating" &&
                    <Button miw="10rem" onClick={onCancel} color="red">Cancel</Button>}
                {state.state === "done" &&
                    <Button miw="10rem" onClick={onSave} color="green">Save</Button>}
            </Group>
        </Flex>
    );
}
