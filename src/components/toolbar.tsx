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

import { debounce } from "lodash";
import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { ButtonToolbar, ButtonGroup, Button, FormControl, InputGroup, Dropdown } from "react-bootstrap";
import * as Icon from "react-bootstrap-icons";
import { ActionController } from "../actions";
import "../css/toolbar.css";

interface ToolbarProps {
    setSearchTerms: (terms: string[]) => void,
    actionController: ActionController,
    altSpeedMode: boolean,
    setShowLabelsModal: (show: boolean) => void,
    selectedTorrents: Set<number>,
}

export function Toolbar(props: ToolbarProps) {
    const debouncedSetSearchTerms = useMemo(
        () => debounce(props.setSearchTerms, 500, { trailing: true, leading: false }),
        [props.setSearchTerms]);

    const [altSpeedMode, setAltSpeedMode] = useState<boolean>();

    const toggleAltSpeedMode = useCallback(() => {
        console.log("Toggling altspeedmode");
        props.actionController.run("setAltSpeedMode", !altSpeedMode)
            .catch((e) => {
                console.log("Can't set alt speed mode", e);
            });
        setAltSpeedMode(!altSpeedMode);
    }, [altSpeedMode]);

    useEffect(() => {
        if (props.altSpeedMode !== undefined)
            setAltSpeedMode(props.altSpeedMode);
    }, [props.altSpeedMode]);

    const onSearchInput = useCallback((e: React.FormEvent) => {
        debouncedSetSearchTerms(
            (e.target as HTMLInputElement).value
                .split(" ")
                .map((s) => s.trim().toLowerCase())
                .filter((s) => s != ""));
    }, [debouncedSetSearchTerms]);

    const onResume = useCallback(() => {
        props.actionController.run("resumeTorrents", Array.from(props.selectedTorrents)).catch((e) => {
            console.log("Can't resume torrents", e);
        });
    }, [props.actionController, props.selectedTorrents]);

    const onPause = useCallback(() => {
        props.actionController.run("pauseTorrents", Array.from(props.selectedTorrents)).catch((e) => {
            console.log("Can't resume torrents", e);
        });
    }, [props.actionController, props.selectedTorrents]);

    return (
        <ButtonToolbar className="main-toolbar">
            <ButtonGroup className="me-2">
                <Button variant="light" className="p-1"><Icon.FileArrowDownFill size={24} color="seagreen" /></Button>
                <Button variant="light" className="p-1"><Icon.MagnetFill size={24} color="seagreen" /></Button>
            </ButtonGroup>
            <ButtonGroup className="me-2">
                <Button variant="light" className="p-1"><Icon.PlayCircleFill size={24} color="steelblue" onClick={onResume} /></Button>
                <Button variant="light" className="p-1"><Icon.PauseCircleFill size={24} color="steelblue" onClick={onPause} /></Button>
                <Button variant="light" className="p-1"><Icon.XCircleFill size={24} color="tomato" /></Button>
            </ButtonGroup>
            <ButtonGroup className="me-2">
                <Button variant="light" className="p-1"><Icon.ArrowUpCircleFill size={24} color="seagreen" /></Button>
                <Button variant="light" className="p-1"><Icon.ArrowDownCircleFill size={24} color="seagreen" /></Button>
            </ButtonGroup>
            <ButtonGroup className="me-2">
                <Button variant="light" className="p-1"><Icon.FolderFill size={24} color="gold" /></Button>
                <Button variant="light" className="p-1">
                    <Icon.TagsFill size={24} color="steelblue" onClick={() => props.setShowLabelsModal(true)} />
                </Button>
                <Dropdown>
                    <Dropdown.Toggle variant="light">
                        <Icon.ExclamationDiamondFill size={24} color="gold" />
                    </Dropdown.Toggle>

                    <Dropdown.Menu>
                        <Dropdown.Item><Icon.CircleFill color="tomato" className="me-2" /><span>High</span></Dropdown.Item>
                        <Dropdown.Item><Icon.CircleFill color="seagreen" className="me-2" /><span>Normal</span></Dropdown.Item>
                        <Dropdown.Item><Icon.CircleFill color="gold" className="me-2" /><span>Low</span></Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </ButtonGroup>
            <Button
                variant="light"
                title={`Turn alternative bandwidth mode ${altSpeedMode ? "off" : "on"}`}
                className={`me-2 p-1 ${altSpeedMode ? "alt" : ""}`}
                onClick={toggleAltSpeedMode}
            >
                <Icon.Speedometer2 size={24} />
            </Button>
            <InputGroup className="flex-grow-1 me-2">
                <InputGroup.Text><Icon.Search size={16} /></InputGroup.Text>
                <FormControl
                    type="text"
                    placeholder="search"
                    onInput={onSearchInput}
                />
            </InputGroup>
            <Button variant="light" className="p-1"><Icon.Tools size={24} /></Button>
        </ButtonToolbar >
    );
}
