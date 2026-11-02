# Internationalization

English is the fallback language for the desktop and web interfaces. The main
application initializes i18next before rendering localized content; the desktop
creation window initializes it from the language sent by the main window.

## Adding a language

1. Add `locales/<code>.json`, using `locales/en.json` as the key reference. Use a
   standard language tag such as `ru` or `zh-CN` for the filename and registration.
   A partial translation is welcome: omit untranslated keys to use English.
2. Add one entry to `languageNames` in `language.ts`, for example
   `ru: "Русский",`. This supplies the language selector, supported-language type
   and automatic language detection. Resources are loaded from the matching JSON
   filename without another import or registration.
3. Add one entry to `define_languages!` in `../../src-tauri/src/i18n.rs`, for
   example `Russian => "ru",`. The macro generates the Rust enum variant,
   language-code mapping and cached resource loaded from the same JSON file.

No changes to individual components, application configuration or build scripts
are needed to register a language. Keep `language.ts` and `translate.ts` free of
translation-resource and i18next imports so the startup loader remains small.

## Translation format

- Preserve key names, nesting and interpolation placeholders such as `{{name}}`
  and `{{count}}`. Translate the surrounding text rather than the placeholders.
- Use complete messages rather than fragments that depend on English word order.
- Use i18next JSON v4 plural suffixes for the target language, with `count` supplied
  by the caller. For example, English has `_one` and `_other`; Russian also uses
  `_few` and `_many`. Keep each form's placeholders intact.
- Keep protocol values, paths, user input and daemon diagnostics unchanged.

For Auto, browser language preferences are checked in order. Each preference is
matched by its full language tag first, then by its base language. If several
registered variants share a base, the first registered variant is used. An
unsupported preference falls back to English. Explicit preferences are stored in
the existing configuration; Auto leaves that preference unset.

The Rust backend uses the same JSON files for native menus, notification titles
and application-generated errors. It stores the selected language as an enum;
unknown language codes fall back to English. Missing native keys also fall back
to English. Native messages use simple string lookup, and their callers replace
any placeholders; they do not use i18next plural selection.
