# TrguiNG
## Remote GUI for Transmission torrent daemon

![logo](https://i.imgur.com/QdgMWwW.png)

`TrguiNG` is a rewrite of [transgui](https://github.com/transmission-remote-gui/transgui)
project using [tauri](https://tauri.studio/).
Frontend is written in typescript with [react.js](https://react.dev/) and
[mantine](https://mantine.dev/) library, backend is written in [rust](https://www.rust-lang.org/).

This program is multi platform and is tested on Windows and Linux, Mac builds also should work. It supports all of latest transmission features like labels, bandwidth groups and sequential download.

Some differentiating features:
* Multi tabbed interface for concurrent server connections
* Dark and white theme
* Powerful torrent filtering options
* Torrent creation with fast multi threaded hashing

Planned:

* [] Same web interface adapted to be served over http by transmission daemon itself using `$TRANSMISSION_WEB_HOME`
* [] Better system integration with Linux and possibly MacOS with mime types (needs support in tauri)
* [] Better bandwidth groups support when API is ready (https://github.com/transmission/transmission/issues/5455)

Legacy transmission versions will not be supported. Currently v2.80 or later is required, goal is to have v2.40 and up compatibility.

Project is distributed under GNU Affero General Public License v3, see `LICENSE.txt` for details.
