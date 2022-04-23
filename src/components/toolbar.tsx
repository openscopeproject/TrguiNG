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
import { ButtonToolbar, ButtonGroup, Button, FormControl, InputGroup, Dropdown } from "react-bootstrap";
import * as Icon from "react-bootstrap-icons";
import "../css/toolbar.css";

interface ToolbarProps {

}

export function Toolbar(props: ToolbarProps) {
    return (
        <ButtonToolbar>
            <ButtonGroup className="me-2">
                <Button variant="light" className="p-1"><Icon.FileArrowDownFill size={24} color="seagreen" /></Button>
                <Button variant="light" className="p-1"><Icon.MagnetFill size={24} color="seagreen" /></Button>
            </ButtonGroup>
            <ButtonGroup className="me-2">
                <Button variant="light" className="p-1"><Icon.PlayCircleFill size={24} color="steelblue" /></Button>
                <Button variant="light" className="p-1"><Icon.PauseCircleFill size={24} color="steelblue" /></Button>
                <Button variant="light" className="p-1"><Icon.XCircleFill size={24} color="tomato" /></Button>
            </ButtonGroup>
            <ButtonGroup className="me-2">
                <Button variant="light" className="p-1"><Icon.ArrowUpCircleFill size={24} color="seagreen" /></Button>
                <Button variant="light" className="p-1"><Icon.ArrowDownCircleFill size={24} color="seagreen" /></Button>
            </ButtonGroup>
            <ButtonGroup className="me-2">
                <Button variant="light" className="p-1"><Icon.FolderFill size={24} color="gold" /></Button>
                <Button variant="light" className="p-1"><Icon.TagsFill size={24} color="steelblue" /></Button>
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
            <Button variant="light" className="me-2 p-1"><Icon.Speedometer2 size={24} /></Button>
            <InputGroup className="flex-grow-1 me-2">
                <InputGroup.Text><Icon.Search size={16} /></InputGroup.Text>
                <FormControl
                    type="text"
                    placeholder="search"
                />
            </InputGroup>
            <Button variant="light" className="p-1"><Icon.Tools size={24} /></Button>
        </ButtonToolbar >
    );
}
