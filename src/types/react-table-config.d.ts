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

import {
    UseColumnOrderInstanceProps,
    UseColumnOrderState,
    UseExpandedHooks,
    UseExpandedInstanceProps,
    UseExpandedOptions,
    UseExpandedRowProps,
    UseExpandedState,
    UseFiltersColumnOptions,
    UseFiltersColumnProps,
    UseFiltersInstanceProps,
    UseFiltersOptions,
    UseFiltersState,
    UseGlobalFiltersColumnOptions,
    UseGlobalFiltersInstanceProps,
    UseGlobalFiltersOptions,
    UseGlobalFiltersState,
    UseGroupByCellProps,
    UseGroupByColumnOptions,
    UseGroupByColumnProps,
    UseGroupByHooks,
    UseGroupByInstanceProps,
    UseGroupByOptions,
    UseGroupByRowProps,
    UseGroupByState,
    UsePaginationInstanceProps,
    UsePaginationOptions,
    UsePaginationState,
    UseResizeColumnsColumnOptions,
    UseResizeColumnsColumnProps,
    UseResizeColumnsOptions,
    UseResizeColumnsState,
    UseRowSelectHooks,
    UseRowSelectInstanceProps,
    UseRowSelectOptions,
    UseRowSelectRowProps,
    UseRowSelectState,
    UseRowStateCellProps,
    UseRowStateInstanceProps,
    UseRowStateOptions,
    UseRowStateRowProps,
    UseRowStateState,
    UseSortByColumnOptions,
    UseSortByColumnProps,
    UseSortByHooks,
    UseSortByInstanceProps,
    UseSortByOptions,
    UseSortByState
} from 'react-table'

declare module 'react-table' {
    // take this file as-is, or comment out the sections that don't apply to your plugin configuration

    export interface TableOptions<D extends object = {}>
        extends UseExpandedOptions<D>,
        UseFiltersOptions<D>,
        UseGlobalFiltersOptions<D>,
        // UseGroupByOptions<D>,
        // UsePaginationOptions<D>,
        UseResizeColumnsOptions<D>,
        // UseRowSelectOptions<D>,
        // UseRowStateOptions<D>,
        UseSortByOptions<D>
    // note that having Record here allows you to add anything to the options, this matches the spirit of the
    // underlying js library, but might be cleaner if it's replaced by a more specific type that matches your
    // feature set, this is a safe default.
    // Record<string, any>
    { }

    export interface Hooks<D extends object = {}>
        extends UseExpandedHooks<D>,
        // UseGroupByHooks<D>,
        // UseRowSelectHooks<D>,
        UseSortByHooks<D> { }

    export interface TableInstance<D extends object = {}>
        extends UseColumnOrderInstanceProps<D>,
        UseExpandedInstanceProps<D>,
        UseFiltersInstanceProps<D>,
        UseGlobalFiltersInstanceProps<D>,
        // UseGroupByInstanceProps<D>,
        // UsePaginationInstanceProps<D>,
        // UseRowSelectInstanceProps<D>,
        // UseRowStateInstanceProps<D>,
        UseSortByInstanceProps<D> { }

    export interface TableState<D extends object = {}>
        extends UseColumnOrderState<D>,
        UseExpandedState<D>,
        UseFiltersState<D>,
        UseGlobalFiltersState<D>,
        // UseGroupByState<D>,
        // UsePaginationState<D>,
        UseResizeColumnsState<D>,
        // UseRowSelectState<D>,
        // UseRowStateState<D>,
        UseSortByState<D> { }

    export interface ColumnInterface<D extends object = {}>
        extends UseFiltersColumnOptions<D>,
        UseGlobalFiltersColumnOptions<D>,
        // UseGroupByColumnOptions<D>,
        UseResizeColumnsColumnOptions<D>,
        UseSortByColumnOptions<D> { }

    export interface ColumnInstance<D extends object = {}>
        extends UseFiltersColumnProps<D>,
        // UseGroupByColumnProps<D>,
        UseResizeColumnsColumnProps<D>,
        UseSortByColumnProps<D> { }

    export interface Cell<D extends object = {}, V = any>
        extends UseGroupByCellProps<D>
        // UseRowStateCellProps<D> { }
    { }

    export interface Row<D extends object = {}>
        extends UseExpandedRowProps<D>
        // UseGroupByRowProps<D>,
        // UseRowSelectRowProps<D>
        // UseRowStateRowProps<D> { }
    { }
}
