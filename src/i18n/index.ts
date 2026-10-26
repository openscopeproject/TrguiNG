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

import type { ResourceLanguage } from "i18next";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import type { Config } from "../config";
import type { LanguagePreference } from "./language";
import { availableLanguages, resolveLanguage } from "./language";
import { setTranslator } from "./translate";
declare const require: {
    context: (directory: string, recursive: boolean, pattern: RegExp) => (key: string) => ResourceLanguage,
};

const locales = require.context("./locales", false, /\.json$/);
const resources = Object.fromEntries(availableLanguages.map((language) => [
    language,
    { translation: locales(`./${language}.json`) },
]));

const i18n = createInstance().use(initReactI18next);
let initialization: Promise<unknown> | undefined;

function browserLanguages(): readonly string[] {
    return navigator.languages?.length > 0 ? navigator.languages : [navigator.language ?? "en"];
}

export function getAutomaticLanguage() {
    return resolveLanguage(undefined, browserLanguages());
}

const syncDocumentLanguage = () => {
    document.documentElement.lang = i18n.resolvedLanguage ?? "en";
};

i18n.on("languageChanged", syncDocumentLanguage);

export async function initializeI18n(preference: LanguagePreference) {
    const language = resolveLanguage(preference, browserLanguages());
    initialization ??= i18n.init({
        resources,
        lng: language,
        fallbackLng: "en",
        supportedLngs: [...availableLanguages],
        compatibilityJSON: "v4",
        showSupportNotice: false,
        interpolation: { escapeValue: false },
    });
    await initialization;
    if (i18n.resolvedLanguage !== language) await i18n.changeLanguage(language);
    setTranslator((key, options) => i18n.t(key, options));
    syncDocumentLanguage();
}

export async function setLanguagePreference(config: Config, preference: LanguagePreference) {
    config.values.app.language = preference;
    await Promise.all([
        config.save(),
        i18n.changeLanguage(resolveLanguage(preference, browserLanguages())),
    ]);
}

export function synchronizeNativeLanguage(send: (language: string) => Promise<unknown>) {
    const sync = async () => await send(i18n.resolvedLanguage ?? "en");
    const onLanguageChanged = () => {
        void sync().catch(console.error);
    };
    i18n.on("languageChanged", onLanguageChanged);
    return {
        ready: sync().catch(console.error),
        stop: () => { i18n.off("languageChanged", onLanguageChanged); },
    };
}

export default i18n;
