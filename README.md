# TrguiNG
**Remote GUI for Transmission torrent daemon**

![logo](https://i.imgur.com/QdgMWwW.png)

`TrguiNG` is a rewrite of [transgui](https://github.com/transmission-remote-gui/transgui)
project using [tauri](https://tauri.studio/).
Frontend is written in typescript with [react.js](https://react.dev/) and
[mantine](https://mantine.dev/) library. Backend for the app is written in
[rust](https://www.rust-lang.org/).

You can use this program in 2 ways: as a native Windows/Linux/Mac app and as a web gui
served by transmission itself by setting `$TRANSMISSION_WEB_HOME` environment variable
to point to TrguiNG web assets.

There are screenshots of the app available on the
[project wiki](https://github.com/openscopeproject/TrguiNG/wiki).

Some differentiating features:

* Multi tabbed interface for concurrent server connections (native app only)
* Torrent creation with fast multi threaded hashing (native app only)
* Powerful torrent filtering options
* Latest transmission features support: labels, bandwidth groups, sequential download
* Dark and white theme

Planned:

* Better system integration with MacOS with mime types (needs support in tauri)
* Better bandwidth groups support when API is ready (https://github.com/transmission/transmission/issues/5455)

Currently transmission v2.80 or later is required, goal is to have v2.40 and up compatibility.

## Compiling

Get [Node.js 16](https://nodejs.org/) or later and [rust 1.60](https://www.rust-lang.org/)
or later and run

```
$ npm install
$ npm run build
```

This will generate optimized bundle in `dist` and a release binary in `src-tauri/target/release` folder.
Also installer package will be available in `src-tauri/target/release/bundle/...`.

The binary is statically linked and embeds all necessary assets. It is completely self sufficient
and can be used as a portable executable.

For development run in parallel

```
$ npm run webpack-serve
$ npm run tauri-dev
```

Webpack will automatically watch changes in `src/` and refresh the app view, tauri will watch changes
in `src-tauri/` and rebuild/restart the app as needed.

## License
Project is distributed under GNU Affero General Public License v3, see `LICENSE.txt` for details.
