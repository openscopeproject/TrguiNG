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

import { Button, Checkbox, Divider, Group, Modal } from "@mantine/core";
import { ModalState } from "./common";
import React, { useCallback, useState } from "react";
import { ActionController } from "actions";

interface DeleteModalProps extends ModalState {
    actioController: ActionController
}

export function RemoveModal(props: DeleteModalProps) {
    const [deleteData, setDeleteData] = useState<boolean>(false);

    const onDelete = useCallback(() => {
        props.actioController.run("remove", deleteData).catch(console.log);
        props.close();
    }, [props.actioController, deleteData]);

    return (
        <Modal opened={props.opened} onClose={props.close} title="Remove torrents" centered>
            <Divider my="sm" />
            <Checkbox
                label="Delete torrent data"
                checked={deleteData}
                onChange={(e) => setDeleteData(e.currentTarget.checked)}
                my="xl" />
            <Divider my="sm" />
            <Group position="center" spacing="md">
                <Button onClick={onDelete} variant="filled" color="red">{deleteData ? "Delete" : "Remove"}</Button>
                <Button onClick={props.close} variant="light">Cancel</Button>
            </Group>
        </Modal>
    );
}