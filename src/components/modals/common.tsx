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
