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
import { Col, Container, Row } from "react-bootstrap";
import { byteRateToHumanReadableStr, bytesToHumanReadableStr } from "../util";
import * as Icon from "react-bootstrap-icons";

export interface StatusbarProps {
    daemon_version: string,
    hostname: string,
    down_rate: number,
    down_rate_limit: number,
    up_rate: number,
    up_rate_limit: number,
    free: number,
    size_total: number,
    size_selected: number,
    size_done: number,
    size_left: number,
}

export function Statusbar(props: StatusbarProps) {
    return (
        <Container fluid>
            <Row>
                <Col sm={3}>{`${props.daemon_version} at ${props.hostname}`}</Col>
                <Col>
                    <Icon.ArrowDown className="me-2" />
                    <span>{`${bytesToHumanReadableStr(props.down_rate)}/s (${byteRateToHumanReadableStr(props.down_rate_limit * 1024)})`}</span>
                </Col>
                <Col>
                    <Icon.ArrowUp className="me-2" />
                    <span>{`${bytesToHumanReadableStr(props.up_rate)}/s (${byteRateToHumanReadableStr(props.up_rate_limit * 1024)})`}</span>
                </Col>
                <Col>
                    <Icon.Hdd className="me-2" />
                    <span>{`Free: ${bytesToHumanReadableStr(props.free)}`}</span>
                </Col>
                <Col>{`Total: ${bytesToHumanReadableStr(props.size_total)}`}</Col>
                <Col sm={3}>{`Selected: ${bytesToHumanReadableStr(props.size_selected)}, done ${bytesToHumanReadableStr(props.size_done)}, left ${bytesToHumanReadableStr(props.size_left)}`}</Col>
            </Row>
        </Container>
    );
}
