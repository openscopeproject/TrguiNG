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

import { Badge, CloseButton, MultiSelect, MultiSelectValueProps, Text } from "@mantine/core";
import { ActionModalState, SaveCancelModal, TorrentsNames } from "./common";
import React, { useCallback, useEffect, useMemo, useState } from "react";

function Label({
    label,
    onRemove,
    classNames,
    ...others
}: MultiSelectValueProps) {
    return (
        <div {...others}>
            <Badge radius="md" variant="filled"
                rightSection={
                    <CloseButton
                        onMouseDown={onRemove}
                        variant="transparent"
                        size={22}
                        iconSize={14}
                        tabIndex={-1}
                        mr="-0.25rem"
                    />
                }
            >
                {label}
            </Badge>
        </div>
    );
}

interface EditLabelsProps extends ActionModalState {
    allLabels: string[],
}

export function EditLabelsModal(props: EditLabelsProps) {
    const [labels, setLabels] = useState<string[]>([]);

    const initialLabels = useMemo(() => {
        const selected = props.actionController.torrents.filter(
            (t) => props.actionController.selectedTorrents.has(t.id));
        var labels: string[] = [];
        selected.forEach((t) => t.labels.forEach((l: string) => {
            if (!labels.includes(l)) labels.push(l);
        }));
        return labels;
    }, [props.actionController.torrents, props.actionController.selectedTorrents]);

    useEffect(() => {
        setLabels(initialLabels);
    }, [initialLabels]);

    const onSave = useCallback(() => {
        props.actionController.run("setLabels", labels).catch(console.log);
        props.close();
    }, [props, labels]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            centered
            title="Edit torrent labels"
        >
            <Text mb="md">Enter new labels for</Text>
            <TorrentsNames actionController={props.actionController} />
            <MultiSelect
                data={props.allLabels}
                value={labels}
                onChange={setLabels}
                withinPortal
                searchable
                creatable
                getCreateLabel={(query) => `+ Add ${query}`}
                onCreate={(query) => {
                    setLabels((current) => [...current, query]);
                    return query;
                }}
                valueComponent={Label}
            />
        </SaveCancelModal>
    );
}
