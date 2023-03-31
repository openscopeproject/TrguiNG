import { Badge, CloseButton, MultiSelect, MultiSelectValueProps } from "@mantine/core";
import { ModalState, SaveCancelModal } from "./common";
import React, { useCallback, useEffect, useState } from "react";

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

interface EditLabelsProps extends ModalState {
    allLabels: string[],
    labels: string[],
    onSave: (labels: string[]) => void,
}

export function EditLabelsModal(props: EditLabelsProps) {
    const [labels, setLabels] = useState<string[]>([]);

    useEffect(() => {
        setLabels(props.labels);
    }, [props.labels]);

    const onSave = useCallback(() => {
        props.onSave(labels);
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
