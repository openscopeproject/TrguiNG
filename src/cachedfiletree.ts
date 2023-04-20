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

import { Torrent } from "./rpc/torrent";
import { PriorityNumberType } from "rpc/transmission";

interface Entry {
    name: string,
    level: number,
    fullpath: string,
    originalpath: string,
    parent?: DirEntry,
    size: number,
    done: number,
    percent: number,
    isSelected: boolean,
}

export interface FileEntry extends Entry {
    index: number,
    want: boolean,
    priority: PriorityNumberType,
}

export interface DirEntry extends Entry {
    want?: boolean,
    priority?: PriorityNumberType,
    subdirs: Map<string, DirEntry>,
    files: Map<string, FileEntry>,
    expanded: boolean,
}

export type FileDirEntry = FileEntry | DirEntry;

export function isDirEntry(entry: FileDirEntry): entry is DirEntry {
    return "expanded" in entry;
}

export class CachedFileTree {
    tree: DirEntry;
    torrenthash: string;
    files: FileEntry[];
    filePathToIndex: Record<string, number>;

    constructor() {
        this.tree = {
            name: "",
            level: 0,
            fullpath: "/",
            originalpath: "/",
            size: 0,
            want: true,
            priority: 0,
            done: 0,
            percent: 0,
            subdirs: new Map(),
            files: new Map(),
            expanded: true,
            isSelected: false,
        }
        this.torrenthash = "";
        this.files = [];
        this.filePathToIndex = {};
    }

    destroy(dir: DirEntry) {
        // recurse into the tree and unlink everyone's parents
        // to allow gc to do it's work
        dir.subdirs.forEach((d) => this.destroy(d));
        dir.subdirs.clear();
        dir.files.forEach((f) => f.parent = undefined);
        dir.files.clear();
        dir.parent = undefined;
    }

    recalcTree(dir: DirEntry) {
        // recurse into the tree to recalculate sizes, percentages, priorities
        dir.subdirs.forEach((d) => this.recalcTree(d));

        var size = 0;
        var done = 0;
        var want: Set<boolean | undefined> = new Set();
        var priority: Set<PriorityNumberType | undefined> = new Set();

        const update = (e: FileDirEntry) => {
            size += e.size;
            done += e.done;
            want.add(e.want);
            priority.add(e.priority);
        }

        dir.subdirs.forEach(update);
        dir.files.forEach(update);

        dir.size = size;
        dir.done = done;
        dir.percent = done * 100 / size;
        dir.want = want.size == 1 ? [...want][0] : undefined;
        dir.priority = priority.size == 1 ? [...priority][0] : undefined;
    }

    parse(torrent: Torrent, fromFile: boolean) {
        this.torrenthash = torrent.hashString || "";

        this.files = torrent.files.map((entry: any, index: number): FileEntry => {
            var path = (entry.name as string).replace("\\", "/");
            if (path.startsWith(torrent.name + "/"))
                path = path.substring(torrent.name.length + 1);
            return {
                index,
                name: path.substring(path.lastIndexOf("/") + 1),
                level: 0,
                fullpath: path,
                originalpath: entry.name as string,
                size: entry.length as number,
                want: fromFile ? true : torrent.fileStats[index].wanted as boolean,
                done: fromFile ? 0 : torrent.fileStats[index].bytesCompleted,
                percent: fromFile ? 0 : torrent.fileStats[index].bytesCompleted * 100 / entry.length,
                priority: fromFile ? 0 : torrent.fileStats[index].priority,
                isSelected: false,
            }
        });

        var filePathIndex: [string, number][] = this.files.map(
            (f, i): [string, number] => [f.fullpath, i]).sort((a, b) => {
                if (a[0] < b[0]) return -1;
                return 1;
            });

        this.filePathToIndex = {};

        filePathIndex.forEach(([path, index]) => {
            this.filePathToIndex[path] = index;
            var parts = path.split("/");
            var node = this.tree;
            var currentPath = "";
            for (var i = 0; i < parts.length - 1; i++) {
                var subdir = parts[i];
                currentPath = currentPath == "" ? subdir : currentPath + "/" + subdir;
                if (!node.subdirs.has(subdir)) {
                    node.subdirs.set(subdir, {
                        name: subdir,
                        level: i,
                        fullpath: currentPath,
                        originalpath: torrent.name + "/" + currentPath,
                        size: 0,
                        done: 0,
                        percent: 0,
                        subdirs: new Map(),
                        files: new Map(),
                        expanded: false,
                        parent: node,
                        isSelected: false,
                    });
                }
                node = node.subdirs.get(subdir)!;
            }
            node.files.set(parts[parts.length - 1], this.files[index]);
            this.files[index].parent = node;
            this.files[index].level = parts.length - 1;
        });

        this.recalcTree(this.tree);
    }

    update(torrent: Torrent) {
        if (this.torrenthash == torrent.hashString) {
            // update done and percent fields in the tree
            torrent.files.forEach((entry: any, index: number) => {
                var delta = torrent.fileStats[index].bytesCompleted - this.files[index].done;

                this.files[index].done += delta;
                this.files[index].percent = this.files[index].done * 100 / this.files[index].size;

                var node: DirEntry | undefined = this.files[index].parent;

                while (node !== undefined) {
                    node.done += delta;
                    node.percent = node.done * 100 / node.size;

                    node = node.parent;
                }
            });
        } else {
            // rebuild the tree from scratch
            this.destroy(this.tree);

            this.parse(torrent, false);
        }
    }

    flatten(): FileDirEntry[] {
        var result: FileDirEntry[] = [];

        const append = (dir: DirEntry) => {
            dir.subdirs.forEach((d) => {
                result.push(d);
                if (d.expanded)
                    append(d);
            });
            dir.files.forEach((f) => result.push(f));
        }

        append(this.tree);

        return result;
    }

    setWanted(entry: FileDirEntry, state: boolean) {
        const recurse = (dir: DirEntry) => {
            dir.subdirs.forEach((d) => {
                recurse(d);
            });
            dir.want = state;
            dir.files.forEach((f) => {
                f.want = state;
            });
        }

        if(isDirEntry(entry))
            recurse(entry);
        else
            entry.want = state;

        this.recalcTree(this.tree);
    }

    getUnwanted() {
        let result: number[] = [];
        const recurse = (dir: DirEntry) => {
            dir.subdirs.forEach((d) => {
                recurse(d);
            });
            dir.files.forEach((f) => {
                if(!f.want) result.push(f.index);
            });
        }
        recurse(this.tree);
        return result;
    }

    updateDirSelection(dir: DirEntry) {
        let selected = 0;
        dir.subdirs.forEach((d) => {
            this.updateDirSelection(d);
            if(d.isSelected) selected++;
        });
        dir.files.forEach((f) => {if(f.isSelected) selected++});
        if(selected == dir.subdirs.size + dir.files.size)
            dir.isSelected = true;
    }

    setSelection(dir: DirEntry, value: boolean) {
        dir.subdirs.forEach((d) => this.setSelection(d, value));
        dir.files.forEach((f) => {f.isSelected = value});
        dir.isSelected = value;
    }

    selectAction({ verb, ids }: { verb: "add" | "set", ids: string[] }) {
        if (verb == "set")
            this.setSelection(this.tree, false);
        ids.forEach((id) => {
            let parts = id.split("/");
            let i = 0;
            let node = this.tree;
            while(node.subdirs.has(parts[i])) {
                node = node.subdirs.get(parts[i])!;
                i++;
            }
            if( i < parts.length - 1)
                console.log("What the horse?", id);
            if( i < parts.length)
                node.files.get(parts[i])!.isSelected = true;
            else
                this.setSelection(node, true);
        });
        this.updateDirSelection(this.tree);
    }
}
