!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
  Var TahosappDesktopShortcutCheckbox
  Var TahosappStartupCheckbox
  Var TahosappDesktopShortcutState
  Var TahosappStartupState
!endif

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customPageAfterChangeDir
  Page custom TahosappOptionsPageCreate TahosappOptionsPageLeave
!macroend

!macro customInit
  StrCpy $TahosappDesktopShortcutState ${BST_CHECKED}
  StrCpy $TahosappStartupState ${BST_UNCHECKED}
  IfFileExists "$SMSTARTUP\tahosapp.lnk" 0 +2
    StrCpy $TahosappStartupState ${BST_CHECKED}
!macroend

!macro customHeader
  !ifndef BUILD_UNINSTALLER
    Function TahosappOptionsPageCreate
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}

      !insertmacro MUI_HEADER_TEXT "Kurulum seçenekleri" "tahosapp'in Windows ile nasıl bütünleşeceğini seçin."

      ${NSD_CreateLabel} 0 0 100% 28u "Aşağıdaki seçenekleri daha sonra Windows ayarlarından veya kısayolları silerek değiştirebilirsiniz."
      Pop $0

      ${NSD_CreateCheckbox} 0 38u 100% 14u "Masaüstünde tahosapp kısayolu oluştur"
      Pop $TahosappDesktopShortcutCheckbox
      ${NSD_SetState} $TahosappDesktopShortcutCheckbox $TahosappDesktopShortcutState

      ${NSD_CreateCheckbox} 0 64u 100% 14u "Windows'ta oturum açtığımda tahosapp'i otomatik başlat"
      Pop $TahosappStartupCheckbox
      ${NSD_SetState} $TahosappStartupCheckbox $TahosappStartupState

      ${NSD_CreateLabel} 18u 83u 92% 32u "Otomatik başlatma kapalı olsa da tahosapp'i Başlat menüsünde aratarak istediğiniz zaman açabilirsiniz."
      Pop $0

      nsDialogs::Show
    FunctionEnd

    Function TahosappOptionsPageLeave
      ${NSD_GetState} $TahosappDesktopShortcutCheckbox $TahosappDesktopShortcutState
      ${NSD_GetState} $TahosappStartupCheckbox $TahosappStartupState
    FunctionEnd
  !endif
!macroend

!macro customInstall
  ${If} $TahosappDesktopShortcutState == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\tahosapp.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${Else}
    Delete "$DESKTOP\tahosapp.lnk"
  ${EndIf}
  ${If} $TahosappStartupState == ${BST_CHECKED}
    CreateDirectory "$SMSTARTUP"
    CreateShortCut "$SMSTARTUP\tahosapp.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--autostart"
  ${Else}
    Delete "$SMSTARTUP\tahosapp.lnk"
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$DESKTOP\tahosapp.lnk"
  Delete "$SMSTARTUP\tahosapp.lnk"
!macroend
