import os
import subprocess

if "GITHUB_REF" not in os.environ:
    print("GITHUB_REF variable not set")
    exit(1)

REF = os.environ.get("GITHUB_REF")
if REF is None or not REF.startswith("refs/tags/v"):
    print("Invalid version ref:", REF)
    exit(1)

VERSION = REF[len("refs/tags/v"):]

with subprocess.Popen(
        ["sha256sum", "dbip.mmdb"],
        stdout=subprocess.PIPE) as proc:
    DBIP_SHA = proc.stdout.read().decode()[:64]
with subprocess.Popen(
        ["sha256sum", "TrguiNG.desktop"],
        stdout=subprocess.PIPE) as proc:
    DESKTOP_SHA = proc.stdout.read().decode()[:64]


TEMPLATE = '''
# MAINTAINER username227 gfrank227[at]gmail[dot]com
# MAINTAINER qu1ck anlutsenko[at]gmail[dot]com
# This file is generated automatically by CI job at https://github.com/openscopeproject/TrguiNG
pkgname=trgui-ng
pkgver='%VERSION%'
pkgrel=1
pkgdesc='Remote GUI for Transmission torrent daemon'
url="https://github.com/openscopeproject/TrguiNG"
arch=('x86_64')
license=('AGPL-3.0')
depends=('alsa-lib' 'cairo' 'desktop-file-utils' 'fontconfig' 'gdk-pixbuf2' 'glib2' 'gtk3' 'hicolor-icon-theme' 'libayatana-appindicator' 'libsoup' 'openssl' 'webkit2gtk-4.1')
makedepends=('rust>=1.77.2' 'nodejs>=16.0.0' 'npm' 'git')
conflicts=('trgui-ng-git' 'trgui-ng-bin')
source=("git+https://github.com/openscopeproject/TrguiNG#tag=v$pkgver"
        "https://github.com/openscopeproject/TrguiNG/releases/download/v$pkgver/dbip.mmdb"
        "TrguiNG.desktop"::"https://raw.githubusercontent.com/flathub/org.openscopeproject.TrguiNG/master/org.openscopeproject.TrguiNG.desktop")
noextract=('dbip.mmdb')
sha256sums=('SKIP'
            '%DBIP_SHA256%'
            '%DESKTOP_SHA256%')
options=('!lto')

prepare() {
   cd "$srcdir/TrguiNG"

   cp "../dbip.mmdb" "src-tauri/dbip.mmdb"
}

build() {
    cd "$srcdir/TrguiNG"

    npm ci
    npm run build -- -b
}

package() {
    install -dm755 "$pkgdir/usr/bin"
    install -dm755 "$pkgdir/usr/lib/trgui-ng"
    install -dm755 "$pkgdir/usr/share/icons/hicolor/32x32/apps"
    install -dm755 "$pkgdir/usr/share/icons/hicolor/128x128/apps"
    install -Dm755 "$srcdir/TrguiNG/src-tauri/target/release/TrguiNG" "$pkgdir/usr/bin/trgui-ng"
    install -Dm644 "$srcdir/TrguiNG/src-tauri/dbip.mmdb" "$pkgdir/usr/lib/trgui-ng/dbip.mmdb"
    install -Dm755 "$srcdir/TrguiNG.desktop" "$pkgdir/usr/share/applications/TrguiNG.desktop"
    install -Dm644 "$srcdir/TrguiNG/src-tauri/icons/32x32.png" "$pkgdir/usr/share/icons/hicolor/32x32/apps/trgui-ng.png"
    install -Dm644 "$srcdir/TrguiNG/src-tauri/icons/128x128.png" "$pkgdir/usr/share/icons/hicolor/128x128/apps/trgui-ng.png"
    install -Dm644 "$srcdir/TrguiNG/src-tauri/icons/app.svg" "$pkgdir/usr/share/icons/hicolor/scalable/apps/trgui-ng.svg"
}
'''

TEMPLATE_VALUES = {
    "%VERSION%": VERSION,
    "%DBIP_SHA256%": DBIP_SHA,
    "%DESKTOP_SHA256%": DESKTOP_SHA,
}

pkgbuild = TEMPLATE[1:]
for k, v in TEMPLATE_VALUES.items():
    pkgbuild = pkgbuild.replace(k, v)

with open("PKGBUILD", "w") as f:
    f.write(pkgbuild)
