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

import React from 'react';
import { Container, Row } from 'react-bootstrap';
import '../css/filters.css';
import { getTorrentError, Torrent } from '../rpc/torrent';
import { Status } from '../rpc/transmission';

export interface TorrentFilter {
    label: string;
    filter: (t: Torrent) => boolean;
    element?: HTMLElement;
}

const statusFilters: TorrentFilter[] = [
    { label: "All Torrents", filter: (t: Torrent) => true },
    { label: "Downloading", filter: (t: Torrent) => t.status == Status.downloading },
    {
        label: "Completed", filter: (t: Torrent) => {
            return t.status == Status.seeding || t.sizeWhenDone > 0 && t.leftUntilDone == 0;
        }
    },
    {
        label: "Active", filter: (t: Torrent) => {
            return t.rateDownload > 0 || t.rateUpload > 0;
        }
    },
    {
        label: "Inactive", filter: (t: Torrent) => {
            return t.rateDownload == 0 && t.rateUpload == 0 && t.status != Status.stopped;
        }
    },
    { label: "Stopped", filter: (t: Torrent) => t.status == Status.stopped },
    { label: "Error", filter: (t: Torrent) => (t.error != 0 || !!getTorrentError(t)) },
    {
        label: "Waiting", filter: (t: Torrent) => [
            Status.verifying,
            Status.queuedToVerify,
            Status.queuedToDownload].includes(t.status)
    },
]

export const DefaultFilter = statusFilters[0];

interface FiltersProps {
    torrents: Torrent[];
    currentFilter: TorrentFilter;
    setCurrentFilter: (filter: TorrentFilter) => void;
}

export function Filters(props: FiltersProps) {
    return (
        <Container fluid className='w-100'>
            {statusFilters.map((f) => {
                var count = 0;

                for (var torrent of props.torrents) {
                    if (f.filter(torrent)) count++;
                }

                return <Row
                    key={`status-${f.label}`}
                    className={`p-1${props.currentFilter === f ? ' bg-primary text-white' : ''}`}
                    onClick={() => props.setCurrentFilter(f)}>
                    {`${f.label} (${count})`}
                </Row>;
            })}
        </Container>
    );
}
