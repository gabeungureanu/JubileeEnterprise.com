' Elevate and Register Jubilee Auto-Start Task
' This script elevates itself and runs the PowerShell registration script

Set objShell = CreateObject("Shell.Application")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get the directory of this script
strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
strPSScript = strScriptPath & "\register-task.ps1"

' Run PowerShell elevated
objShell.ShellExecute "powershell.exe", "-ExecutionPolicy Bypass -File """ & strPSScript & """", "", "runas", 1

WScript.Quit
