TrguiNG portable mode for Windows
================================

Extract the portable ZIP to a writable folder outside Program Files. Windows
must have the WebView2 Runtime installed; it is not included in the package.

Close TrguiNG completely before migrating settings or updating the application.
To import your installed settings, run Import-Settings.cmd before starting the
portable executable. It copies %APPDATA%\trguing.json, keeps an identical backup
in Data\Backups, verifies SHA-256 and leaves the original unchanged. Import is
refused when Data\trguing.json already exists. To use a different source:

  .\Import-Settings.ps1 -Source 'D:\Backup\trguing.json'

Package layout:
  TrguiNG.exe             Application
  dbip.mmdb               Local GeoIP database
  portable.flag           Enables portable mode
  Data\trguing.json       Configuration and server profiles
  Data\WebView2\          WebView2 profile/cache, created when starting the app
  Data\Backups\           Original configuration copied by the import helper
  BUILD-INFO.txt          Source commit and executable/GeoIP SHA-256 hashes

Move the entire folder to use it on another drive or computer. Existing remote
and local path mappings may need adjustment. The old EBWebView cache does not
need to be copied; the application creates a new profile. Configuration files
and backups contain reversibly obfuscated passwords and should be protected.

Keep portable.flag and Data when updating. Close the app and back up the folder
before replacing program files. Without portable.flag, the executable uses the
existing installed configuration location. An unusable portable data directory
does not silently fall back to the installed profile.

Do not run installed and portable copies simultaneously: the application's
single-instance listener uses the same loopback port. Avoid enabling .torrent
or magnet associations if you do not want registry integration on that PC.

To build on Windows, put dbip.mmdb in src-tauri, install the project's build
prerequisites, run npm ci and npm run tauri -- build --no-bundle --ci -- --locked,
then run ./ci/package_windows_portable.ps1. Packages and SHA-256 files are written
to portable-output. The packaging script refuses to overwrite existing output.

License: GNU Affero General Public License v3 or later; see LICENSE.txt.
GeoIP: DB-IP Country Lite, CC BY 4.0, https://db-ip.com/db/download/ip-to-country-lite
