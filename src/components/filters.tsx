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

import React, { useMemo } from 'react';
import '../css/filters.css';
import { getTorrentError, Torrent } from '../rpc/torrent';
import { Status } from '../rpc/transmission';

export interface TorrentFilter {
    id: string;
    filter: (t: Torrent) => boolean;
}

interface LabeledFilter {
    label: string;
    filter: (t: Torrent) => boolean;
}

const statusFilters: LabeledFilter[] = [
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

const noLabelsFilter: LabeledFilter = {
    label: "<No labels>",
    filter: (t: Torrent) => t.labels.length == 0,
}

export const DefaultFilter = statusFilters[0].filter;

interface FiltersProps {
    torrents: Torrent[];
    allLabels: string[];
    currentFilter: TorrentFilter;
    setCurrentFilter: (filter: TorrentFilter) => void;
}

interface AllFilters {
    statusFilters: LabeledFilter[],
    labelFilters: LabeledFilter[],
}

function FilterRow(props: FiltersProps & { id: string, filter: LabeledFilter }) {
    var count = 0;

    for (var torrent of props.torrents) {
        if (props.filter.filter(torrent)) count++;
    }

    return <div
        className={`px-1 ${props.currentFilter.id === props.id ? ' bg-primary text-white' : ''}`}
        onClick={() => props.setCurrentFilter({ id: props.id, filter: props.filter.filter })}>
        {`${props.filter.label} (${count})`}
    </div>;
}

export function Filters(props: FiltersProps) {
    var allFilters = useMemo<AllFilters>(() => {
        var labelFilters: LabeledFilter[] = [
            noLabelsFilter
        ];
        props.allLabels.forEach((label) => {
            labelFilters.push({
                label,
                filter: (t: Torrent) => t.labels.includes(label)
            });
        });
        return {
            statusFilters,
            labelFilters,
        };
    }, [props.allLabels]);

    return (
        <div className='w-100'>
            {allFilters.statusFilters.map((f) =>
                <FilterRow key={`status-${f.label}`} id={`status-${f.label}`} filter={f} {...props} />)}
            <hr className="my-2 mx-1" />
            {allFilters.labelFilters.map((f) =>
                <FilterRow key={`labels-${f.label}`} id={`labels-${f.label}`} filter={f} {...props} />)}
        </div>
    );
}
