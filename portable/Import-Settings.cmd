@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Import-Settings.ps1" %*
pause
