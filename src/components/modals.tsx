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
import { Button, ButtonGroup, Col, Form, Modal, Row } from "react-bootstrap";
import { Tag, WithContext as ReactTags } from 'react-tag-input';
import { ServerConfig } from "../config";
import { cloneDeep } from "lodash";
import { swapElements, useForceRender } from "../util";

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
        <div className="d-flex flex-column pe-3">
            <div className="border border-secondary flex-grow-1" style={{ minHeight: "20rem" }}>
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
    server: ServerConfig,
    onNameChange: (name: string) => void,
}

function ServerPanel(props: ServerPanelProps) {
    const forceRender = useForceRender();
    const [mappingsString, setMappingsString] = useState("");

    useEffect(() => {
        setMappingsString(props.server.pathMappings.map((m) => `${m.from}=${m.to}`).join("\n"));
    }, [props.server]);


    return (
        <div className="flex-grow-1">
            <Form.Group className="mb-2">
                <Form.Label>Name</Form.Label>
                <Form.Control
                    type="text"
                    onChange={(e) => {
                        props.onNameChange(e.target.value);
                        forceRender();
                    }}
                    value={props.server.name} />
            </Form.Group>
            <Form.Group className="mb-2">
                <Form.Label>Server url</Form.Label>
                <Form.Control type="text" placeholder="http://1.2.3.4:9091/transmission/rpc" onChange={(e) => {
                    props.server.connection.url = e.target.value;
                    forceRender();
                }} value={props.server.connection.url} />
            </Form.Group>
            <Row>
                <Col lg={6}>
                    <Form.Group className="mb-2">
                        <Form.Label>User name</Form.Label>
                        <Form.Control type="text" onChange={(e) => {
                            props.server.connection.username = e.target.value;
                            forceRender();
                        }} value={props.server.connection.username} />
                    </Form.Group>
                </Col>
                <Col lg={6}>
                    <Form.Group className="mb-2">
                        <Form.Label>Password</Form.Label>
                        <Form.Control type="password" onChange={(e) => {
                            props.server.connection.password = e.target.value;
                            forceRender();
                        }} value={props.server.connection.password} />
                    </Form.Group>
                </Col>
            </Row>
            <Form.Group>
                <Form.Label>Path mappings in "remote=local" format, one per line</Form.Label>
                <Form.Control as="textarea"
                    onChange={(e) => {
                        var mappings = e.target.value.split("\n")
                            .filter((line) => line.includes("="))
                            .map((line) => {
                                var equalsPos = line.indexOf("=");
                                return { from: line.substring(0, equalsPos), to: line.substring(equalsPos + 1) };
                            });
                        props.server.pathMappings = mappings;
                        setMappingsString(e.target.value);
                    }}
                    value={mappingsString}
                    style={{ minHeight: "8rem" }} />
            </Form.Group>
        </div>
    );
}


interface ManageServerModalProps extends ModalProps {
    servers: ServerConfig[],
    onSave: (servers: ServerConfig[]) => void,
}

export function ManageServersModal(props: ManageServerModalProps) {
    const handleClose = useCallback(() => props.setShow(false), [props.setShow]);
    const [servers, setServers] = useState(cloneDeep(props.servers));
    const [currentServerIndex, setCurrentServerIndex] = useState(0);

    useEffect(() => {
        setServers(cloneDeep(props.servers));
        if (currentServerIndex >= props.servers.length)
            setCurrentServerIndex(props.servers.length > 0 ? props.servers.length - 1 : 0);
    }, [props.servers, props.show]);


    const onRenameCurrent = useCallback((name: string) => {
        servers[currentServerIndex] = { ...servers[currentServerIndex], name: name };
        setServers(servers.slice());
    }, [servers, currentServerIndex]);

    const onAdd = useCallback(() => {
        servers.push(
            {
                connection: { url: "", useAuth: false, username: "", password: "" },
                name: "new", pathMappings: [], expandedDirFilters: [], lastSaveDirs: []
            }
        );
        setServers(servers.slice());
        setCurrentServerIndex(servers.length - 1);
    }, [servers]);

    const onRemove = useCallback(() => {
        if (currentServerIndex < servers.length) {
            servers.splice(currentServerIndex, 1);
            setServers(servers.slice());
            if (currentServerIndex == servers.length && currentServerIndex > 0)
                setCurrentServerIndex(currentServerIndex - 1);
        }
    }, [servers, currentServerIndex]);

    const onUp = useCallback(() => {
        if (currentServerIndex > 0) {
            swapElements(servers, currentServerIndex, currentServerIndex - 1);
            setServers(servers.slice());
            setCurrentServerIndex(currentServerIndex - 1);
        }
    }, [servers, currentServerIndex]);

    const onDown = useCallback(() => {
        if (currentServerIndex < servers.length - 1) {
            swapElements(servers, currentServerIndex, currentServerIndex + 1);
            setServers(servers.slice());
            setCurrentServerIndex(currentServerIndex + 1);
        }
    }, [servers, currentServerIndex]);


    const onSave = useCallback(() => {
        props.onSave(servers);
        handleClose();
    }, [props.onSave, servers]);

    return (
        <Modal
            show={props.show}
            size="lg"
            onHide={handleClose}
            centered
        >
            <Modal.Header closeButton>
                <Modal.Title>Edit Server Connections</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="d-flex w-100">
                    <ServerListPanel
                        servers={servers.map((s) => s.name)}
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
