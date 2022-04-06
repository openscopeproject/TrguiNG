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
import { Col, Container, Nav, Row, Tab, Tabs } from "react-bootstrap";
import { getTorrentError, Torrent } from "../rpc/torrent";

interface DetailsProps {
    torrent?: Torrent;
}

export function Details(props: DetailsProps) {
    if (!props.torrent) return <div></div>;

    return (
        <Container fluid className="d-flex flex-column h-100">
            <Tab.Container id="details-tabs" defaultActiveKey="general">
                <Nav variant="tabs">
                    <Nav.Link eventKey="general">General</Nav.Link>
                    <Nav.Link eventKey="files">{`Files (${props.torrent.files.length})`}</Nav.Link>
                    <Nav.Link eventKey="peers">Peers</Nav.Link>
                    <Nav.Link eventKey="trackers">Trackers</Nav.Link>
                    <Nav.Link eventKey="stats">Stats</Nav.Link>
                </Nav>
                <Tab.Content className="flex-grow-1">
                    <Tab.Pane eventKey="general">
                        <Row>
                            <Col md={1}>Name:</Col><Col>{props.torrent.name}</Col>
                            <Col md={1}>Error:</Col><Col>{getTorrentError(props.torrent)}</Col>
                        </Row>
                    </Tab.Pane>
                    <Tab.Pane eventKey="files" className="h-100">
                        <Row className="h-100 scrollable">
                            <Container fluid>
                                {props.torrent.files.map(
                                    (file: any) => <Row key={file.name}>{file.name}</Row>)}
                            </Container>
                        </Row>
                    </Tab.Pane>
                    <Tab.Pane eventKey="peers">
                        todo peers
                    </Tab.Pane>
                    <Tab.Pane eventKey="trackers">
                        todo trackers
                    </Tab.Pane>
                    <Tab.Pane eventKey="stats">
                        todo stats
                    </Tab.Pane>
                </Tab.Content>
            </Tab.Container>
        </Container>
    );
}
