#!/bin/bash

VERSION="$1"

function backup_file {
    if [ -f "$1.bkp" ]; then
        rm "$1.bkp"
    fi;
    if [ -f "$1" ]; then
        cp "$1" "$1.bkp"
    fi;
}

backup_file package.json
jq ".version = \"$VERSION\"" package.json.bkp > package.json

backup_file package-lock.json
jq ".version = \"$VERSION\" | .packages.\"\".version = \"$VERSION\"" package-lock.json.bkp > package-lock.json

cd src-tauri

backup_file tauri.conf.json
jq ".version = \"$VERSION\"" tauri.conf.json.bkp > tauri.conf.json

backup_file Cargo.toml
sed -i -E "s/^version = \"[0-9]+\\.[0-9]+\\.[0-9]+\"\$/version = \"$VERSION\"/g" Cargo.toml
