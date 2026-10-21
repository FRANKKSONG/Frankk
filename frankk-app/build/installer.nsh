; Esther's installer, run by hand: a clean install.
;  1. Close Esther and the native Tasks card if they're running.
;  2. Keep your tasks: copy them to "%APPDATA%\Esther backup" first, and leave them where they are.
;  3. Clear everything else old versions left behind (caches, window places and desktop settings, logs, old update
;     downloads), so Esther starts fresh with every card on and in its starting place.
; Esther's own updates (which run this installer quietly) skip steps 2 and 3, so your settings stay.

!macro customInit
  nsExec::Exec 'taskkill /F /T /IM "Esther.exe"'
  nsExec::Exec 'taskkill /F /T /IM "esther-tasks.exe"'
  Sleep 800
!macroend

!macro customInstall
  ${ifNot} ${isUpdated}
    ; Your tasks: a copy first (they also stay where they are).
    CreateDirectory "$APPDATA\Esther backup"
    IfFileExists "$APPDATA\Esther\tasks.json" 0 +2
      CopyFiles /SILENT "$APPDATA\Esther\tasks.json" "$APPDATA\Esther backup"
    IfFileExists "$APPDATA\Esther\Local Storage\*.*" 0 +2
      CopyFiles /SILENT "$APPDATA\Esther\Local Storage" "$APPDATA\Esther backup"
    ; Everything else from older versions.
    RMDir /r "$APPDATA\Esther\Cache"
    RMDir /r "$APPDATA\Esther\Code Cache"
    RMDir /r "$APPDATA\Esther\GPUCache"
    RMDir /r "$APPDATA\Esther\DawnCache"
    RMDir /r "$APPDATA\Esther\DawnGraphiteCache"
    RMDir /r "$APPDATA\Esther\DawnWebGPUCache"
    RMDir /r "$APPDATA\Esther\GrShaderCache"
    RMDir /r "$APPDATA\Esther\ShaderCache"
    RMDir /r "$APPDATA\Esther\Crashpad"
    RMDir /r "$APPDATA\Esther\blob_storage"
    RMDir /r "$APPDATA\Esther\Session Storage"
    RMDir /r "$APPDATA\Esther\Shared Dictionary"
    RMDir /r "$APPDATA\Esther\Service Worker"
    RMDir /r "$APPDATA\Esther\Network"
    RMDir /r "$APPDATA\Esther\WebStorage"
    RMDir /r "$APPDATA\Esther\shared_proto_db"
    RMDir /r "$APPDATA\Esther\VideoDecodeStats"
    Delete "$APPDATA\Esther\Local State"
    Delete "$APPDATA\Esther\Preferences"
    Delete "$APPDATA\Esther\desktop.json"
    Delete "$APPDATA\Esther\esther-native.json"
    Delete "$APPDATA\Esther\esther-log.txt"
    Delete "$APPDATA\Esther\esther-native-log.txt"
    RMDir /r "$LOCALAPPDATA\esther-updater"
  ${endIf}
  ; The native Tasks card (a preview), if this build carries it.
  IfFileExists "$INSTDIR\resources\native\esther-tasks.exe" 0 +2
    CreateShortCut "$SMPROGRAMS\Esther Tasks (native preview).lnk" "$INSTDIR\resources\native\esther-tasks.exe"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Esther Tasks (native preview).lnk"
!macroend
