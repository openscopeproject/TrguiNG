import { Button, Divider, Group, Modal, ModalProps } from "@mantine/core";
import React, { useCallback } from "react";

export interface ModalState {
    opened: boolean,
    close: () => void,
}

interface SaveCancelModalProps extends ModalProps {
    onSave: () => void,
    onClose: () => void,
}

export function SaveCancelModal({ onSave, onClose, children, ...other }: SaveCancelModalProps) {
    const save = useCallback(() => {
        onSave();
        onClose();
    }, [onSave, onClose]);

    return (
        <Modal onClose={onClose} {...other}>
            <Divider my="sm" />
            {children}
            <Divider my="sm" />
            <Group position="center" spacing="md">
                <Button onClick={save} variant="filled">Save</Button>
                <Button onClick={onClose} variant="light">Cancel</Button>
            </Group>
        </Modal>
    );
}
