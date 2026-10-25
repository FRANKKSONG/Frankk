; Esther native's Setup (Inno Setup 6). Built by the Windows workflow: iscc /DAppVersion=X.Y.Z esther-native.iss
;
; Installs for you only (no administrator needed) into %LOCALAPPDATA%\Programs\Esther native, with a Start menu
; entry, and if you like a desktop shortcut and starting with Windows. Your tasks and settings live in
; %APPDATA%\Esther and are never touched: not by installing, not by updating, not by uninstalling.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{6F2C1D7A-4B8E-4E59-9C3A-7E1B5D0A2F64}
AppName=Esther
AppVersion={#AppVersion}
AppVerName=Esther {#AppVersion}
AppPublisher=Esther
AppPublisherURL=https://github.com/FRANKKSONG/Frankk/releases/tag/esther-native
DefaultDirName={localappdata}\Programs\Esther native
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=EstherNativeSetup-{#AppVersion}
SetupIconFile=..\ui\esther.ico
UninstallDisplayIcon={app}\esther-native.exe
UninstallDisplayName=Esther
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; A running Esther is closed for the update (it keeps nothing unsaved: every change is written as it's made), and
; opened again at the end.
CloseApplications=force
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "Put Esther on the desktop"; Flags: unchecked
Name: "startup"; Description: "Start Esther when I sign in"

[Files]
Source: "..\target\release\esther-native.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Esther"; Filename: "{app}\esther-native.exe"
Name: "{autodesktop}\Esther"; Filename: "{app}\esther-native.exe"; Tasks: desktopicon

[Registry]
; Start with Windows (the same value Settings → Desktop turns on and off). Not when Esther updates itself
; (/update=yes): then it stays as you set it.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "Esther native"; ValueData: """{app}\esther-native.exe"""; Tasks: startup; Check: not IsUpdate
; (Uninstalling removes it, however it was turned on.)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: none; ValueName: "Esther native"; Flags: dontcreatekey uninsdeletevalue

[Run]
Filename: "{app}\esther-native.exe"; Description: "Open Esther"; Flags: nowait postinstall

[UninstallRun]
; (Esther closed before it's removed.)
Filename: "{sys}\taskkill.exe"; Parameters: "/IM esther-native.exe /F"; Flags: runhidden; RunOnceId: "CloseEsther"

[Code]
// Run by Esther's own updater (/update=yes)?
function IsUpdate: Boolean;
begin
  Result := ExpandConstant('{param:update|no}') = 'yes';
end;
