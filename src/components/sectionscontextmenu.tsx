/**
 * TrguiNG - next gen remote GUI for transmission torrent daemon
 * Copyright (C) 2023  qu1ck (mail at qu1ck.org)
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

import type { SectionsVisibility } from "config";
import React, { useCallback } from "react";
import type { ContextMenuInfo, ContextMenuProps } from "./contextmenu";
import { ContextMenu } from "./contextmenu";
import type { DropResult } from "react-beautiful-dnd";
import { DragDropContext, Draggable } from "react-beautiful-dnd";
import { reorderElements } from "trutil";
import { StrictModeDroppable } from "./strictmodedroppable";
import { Box, Group, Menu } from "@mantine/core";
import * as Icon from "react-bootstrap-icons";

export function getSectionsMap<S extends string>(sections: SectionsVisibility<S>) {
    return Object.fromEntries(sections.map((section, index) => [section.section, index])) as Record<S, number>;
}

function SectionsContextMenu<S extends string>(props: React.PropsWithChildren<{
    sections: SectionsVisibility<S>,
    setSections: React.Dispatch<SectionsVisibility<S>>,
    contextMenuInfo: ContextMenuInfo,
    setContextMenuInfo: (i: ContextMenuInfo) => void,
    contextMenuContainerRef?: ContextMenuProps["containerRef"],
    onSectionItemMouseEnter?: React.MouseEventHandler<HTMLDivElement>,
    closeOnClickOutside?: boolean,
}>) {
    const { setSections } = props;

    const onSectionMenuItemClick = useCallback((index: number) => {
        const sections = [...props.sections];
        sections[index].visible = !sections[index].visible;
        setSections(sections);
    }, [props.sections, setSections]);

    const onDragEnd = useCallback((result: DropResult) => {
        if (result.destination != null) {
            const sections = reorderElements(props.sections, result.source.index, result.destination.index);
            setSections(sections);
        }
    }, [props.sections, setSections]);

    return (
        <ContextMenu
            contextMenuInfo={props.contextMenuInfo}
            setContextMenuInfo={props.setContextMenuInfo}
            closeOnItemClick={false}
            containerRef={props.contextMenuContainerRef}
            closeOnClickOutside={props.closeOnClickOutside}
        >
            <DragDropContext onDragEnd={onDragEnd}>
                <StrictModeDroppable droppableId="filterscontextmenu">
                    {provided => (
                        <div ref={provided.innerRef} {...provided.droppableProps}>
                            {props.sections.map((section, index) => {
                                return (
                                    <Draggable draggableId={section.section} index={index} key={section.section}>
                                        {(provided) => (
                                            <Group
                                                ref={provided.innerRef}
                                                onMouseEnter={props.onSectionItemMouseEnter}
                                                {...provided.draggableProps}
                                                noWrap
                                            >
                                                <Menu.Item
                                                    icon={section.visible ? <Icon.Check size="1rem" /> : <Box miw="1rem" />}
                                                    onClick={() => { onSectionMenuItemClick(index); }}
                                                >
                                                    {section.section}
                                                </Menu.Item>
                                                <div {...provided.dragHandleProps}>
                                                    <Icon.GripVertical size="12" />
                                                </div>
                                            </Group>
                                        )}
                                    </Draggable>
                                );
                            })}
                            {provided.placeholder}
                        </div>
                    )}
                </StrictModeDroppable>
            </DragDropContext>
            {props.children}
        </ContextMenu>
    );
}

export const MemoSectionsContextMenu = React.memo(SectionsContextMenu) as typeof SectionsContextMenu;
