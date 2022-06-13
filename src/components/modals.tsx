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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Icon from "react-bootstrap-icons";
import { Button, ButtonGroup, Form, Modal } from "react-bootstrap";
import { Tag, WithContext as ReactTags } from 'react-tag-input';
import { Server } from "../config";
import { cloneDeep } from "lodash";
import { swapElements } from "../util";

interface ModalProps {
    show: boolean,
    setShow: (show: boolean) => void,
}

interface EditLabelsProps extends ModalProps {
    allLabels: string[],
    labels: string[],
    onSave: (labels: string[]) => void,
}

export function EditLabelsModal(props: EditLabelsProps) {
    const handleClose = useCallback(() => props.setShow(false), [props.setShow]);
    const suggestions = useMemo(() => props.allLabels.map((l) => { return { id: l, text: l } }), [props.allLabels]);
    const [tags, setTags] = useState<Tag[]>([]);

    useEffect(() => {
        setTags(props.labels.map((l) => { return { id: l, text: l } }));
    }, [props.labels]);

    const handleDelete = (i: number) => {
        setTags(tags.filter((tag, index) => index !== i));
    };

    const handleAddition = (tag: Tag) => {
        setTags([...tags, tag]);
    };

    const handleDrag = (tag: Tag, currPos: number, newPos: number) => {
        const newTags = tags.slice();
        newTags.splice(currPos, 1);
        newTags.splice(newPos, 0, tag);
        setTags(newTags);
    };

    const onSave = useCallback(() => {
        props.onSave(tags.map((t) => t.text));
        handleClose();
    }, [props.onSave, tags]);

    return (
        <Modal
            show={props.show}
            size="lg"
            onHide={handleClose}
            centered
        >
            <Modal.Header closeButton>
                <Modal.Title>Edit torrent labels</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="w-100">
                    <ReactTags
                        tags={tags}
                        suggestions={suggestions}
                        handleDelete={handleDelete}
                        handleAddition={handleAddition}
                        handleDrag={handleDrag}
                        minQueryLength={1}
                        inputFieldPosition="inline"
                        autocomplete
                        classNames={{
                            tags: 'labels',
                            tagInput: 'input',
                            tagInputField: 'form-control',
                            tag: 'tag',
                            remove: 'remove',
                            suggestions: 'suggestions',
                            activeSuggestion: 'active',
                        }}
                    />
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={onSave} variant="primary">Save</Button>
                <Button onClick={handleClose}>Cancel</Button>
            </Modal.Footer>
        </Modal>
    );
}

interface ServerListPanelProps {
    servers: string[],
    current: number,
    onSelect: (current: number) => void,
    onAdd: () => void,
    onRemove: () => void,
    onUp: () => void,
    onDown: () => void,
}

function ServerListPanel(props: ServerListPanelProps) {
    return (
        <div className="d-flex flex-row p-3">
            <div className="border border-secondary flex-grow-1">
                {props.servers.map((s, i) => {
                    return <div key={i} className={("p-1 " + (i == props.current ? "selected" : ""))} onClick={() => { props.onSelect(i) }}>{s}</div>;
                })}
            </div>
            <div className="me-3">
                <ButtonGroup>
                    <Button variant="light" className="p-1" onClick={props.onAdd}><Icon.PlusSquare size={24} color="royalblue" /></Button>
                    <Button variant="light" className="p-1" onClick={props.onRemove}><Icon.DashSquare size={24} color="royalblue" /></Button>
                    <Button variant="light" className="p-1" onClick={props.onUp}><Icon.ArrowUpSquare size={24} color="royalblue" /></Button>
                    <Button variant="light" className="p-1" onClick={props.onDown}><Icon.ArrowDownSquare size={24} color="royalblue" /></Button>
                </ButtonGroup>
            </div>
        </div>
    );
}

interface ServerPanelProps {
    server: Server,
    onNameChange: (name: string) => void,
}

function ServerPanel(props: ServerPanelProps) {
    return (
        <div className="flex-grow-1">
            <Form.Group className="mb-3">
                <Form.Label>Name</Form.Label>
                <Form.Control type="text" onBlur={(e) => {
                    props.server.name = e.target.value;
                    props.onNameChange(e.target.value);
                }} value={props.server.name} />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Server url</Form.Label>
                <Form.Control type="text" placeholder="http://1.2.3.4:9091/transmission/rpc" onChange={(e) => {
                    props.server.connection.url = e.target.value;
                }} value={props.server.connection.url} />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>User name</Form.Label>
                <Form.Control type="text" onChange={(e) => {
                    props.server.connection.username = e.target.value;
                }} value={props.server.connection.username} />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control type="password" onChange={(e) => {
                    props.server.connection.password = e.target.value;
                }} value={props.server.connection.password} />
            </Form.Group>
        </div>
    );
}


interface ManageServerModalProps extends ModalProps {
    servers: Server[],
    onSave: (servers: Server[]) => void,
}

export function ManageServersModal(props: ManageServerModalProps) {
    const handleClose = useCallback(() => props.setShow(false), [props.setShow]);
    const servers = useMemo(() => cloneDeep(props.servers), [props.servers]);
    const [currentServerIndex, setCurrentServerIndex] = useState(0);
    const serverNames = useRef<string[]>(servers.map((s) => s.name));

    const onRenameCurrent = useCallback((name: string) => {
        servers[currentServerIndex].name = name;
        serverNames.current = servers.map((s) => s.name);
    }, []);

    const onAdd = useCallback(() => {
        servers.push(
            {
                connection: { url: "", useAuth: false, username: "", password: "" },
                name: "new", pathMappings: [], expandedDirFilters: [], lastSaveDirs: []
            }
        );
        serverNames.current.push("new");
        setCurrentServerIndex(servers.length - 1);
    }, []);

    const onRemove = useCallback(() => {
        if (currentServerIndex < servers.length) {
            servers.splice(currentServerIndex, 1);
            serverNames.current.splice(currentServerIndex, 1);
        }
    }, []);

    const onUp = useCallback(() => {
        if (currentServerIndex > 0) {
            swapElements(servers, currentServerIndex, currentServerIndex - 1);
            swapElements(serverNames.current, currentServerIndex, currentServerIndex - 1);
            setCurrentServerIndex(currentServerIndex - 1);
        }
    }, []);

    const onDown = useCallback(() => {
        if (currentServerIndex < servers.length) {
            swapElements(servers, currentServerIndex, currentServerIndex + 1);
            swapElements(serverNames.current, currentServerIndex, currentServerIndex + 1);
            setCurrentServerIndex(currentServerIndex + 1);
        }
    }, []);


    const onSave = useCallback(() => {
        props.onSave(servers);
        handleClose();
    }, [props.onSave]);

    return (
        <Modal
            show={props.show}
            size="lg"
            onHide={handleClose}
            centered
        >
            <Modal.Header closeButton>
                <Modal.Title>Edit transmission server connections</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="d-flex w-100">
                    <ServerListPanel
                        servers={serverNames.current}
                        current={currentServerIndex}
                        onSelect={setCurrentServerIndex}
                        onAdd={onAdd}
                        onRemove={onRemove}
                        onUp={onUp}
                        onDown={onDown}
                    />
                    {currentServerIndex >= servers.length ? <></> :
                        <ServerPanel server={servers[currentServerIndex]} onNameChange={onRenameCurrent} />}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={onSave} variant="primary">Save</Button>
                <Button onClick={handleClose}>Cancel</Button>
            </Modal.Footer>
        </Modal>
    );
}
