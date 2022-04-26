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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { Tag, WithContext as ReactTags } from 'react-tag-input';

interface EditLabelsProps {
    allLabels: string[],
    labels: string[],
    show: boolean,
    setShow: (show: boolean) => void,
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
