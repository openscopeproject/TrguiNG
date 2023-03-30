import { ModalState, SaveCancelModal } from "./common";
import { Tag, WithContext as ReactTags } from 'react-tag-input';
import React, { useCallback, useEffect, useMemo, useState } from "react";

interface EditLabelsProps extends ModalState {
    allLabels: string[],
    labels: string[],
    onSave: (labels: string[]) => void,
}

export function EditLabelsModal(props: EditLabelsProps) {
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
        props.close();
    }, [props, tags]);

    return (
        <SaveCancelModal
            opened={props.opened}
            size="lg"
            onClose={props.close}
            onSave={onSave}
            centered
            title="Edit torrent labels"
        >
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
        </SaveCancelModal>
    );
}
