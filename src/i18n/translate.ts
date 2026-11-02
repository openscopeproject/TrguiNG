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

// Core modules are used by the startup loader, before the localized app loads.
// The app installs the translator before rendering any translated UI.
export type Translator = (key: string, options?: Record<string, unknown>) => string;

let translator: Translator = (key) => key;

export function setTranslator(value: Translator) {
    translator = value;
}

export function translate(key: string, options?: Record<string, unknown>): string {
    return translator(key, options);
}
