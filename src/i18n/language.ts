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

// Keep language metadata independent of i18next and translation resources.
// Register each language once; its code also names the JSON file in locales/.
export const languageNames = {
    en: "English",
    "zh-CN": "简体中文",
    ru: "Русский",
} as const;

export type AvailableLanguage = keyof typeof languageNames;
export type LanguagePreference = AvailableLanguage | undefined;
export const availableLanguages = Object.keys(languageNames) as AvailableLanguage[];

export function isAvailableLanguage(value: unknown): value is AvailableLanguage {
    return typeof value === "string" && (availableLanguages as readonly string[]).includes(value);
}

export function resolveLanguage(preference: LanguagePreference, languages: readonly string[]): AvailableLanguage {
    if (isAvailableLanguage(preference)) return preference;
    for (const language of languages) {
        const code = language.toLowerCase();
        const exact = availableLanguages.find((candidate) => candidate.toLowerCase() === code);
        if (exact !== undefined) return exact;
        const base = code.split("-")[0];
        const related = availableLanguages.find((candidate) => candidate.toLowerCase().split("-")[0] === base);
        if (related !== undefined) return related;
    }
    return "en";
}
