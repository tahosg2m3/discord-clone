!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
  Var TahosappDesktopShortcutCheckbox
  Var TahosappStartupCheckbox
  Var TahosappDesktopShortcutState
  Var TahosappStartupState
!else
  Var TahosappUninstallTechnicalRadio
  Var TahosappUninstallPerformanceRadio
  Var TahosappUninstallFeaturesRadio
  Var TahosappUninstallUnusedRadio
  Var TahosappUninstallPrivacyRadio
  Var TahosappUninstallReinstallRadio
  Var TahosappUninstallOtherRadio
  Var TahosappUninstallSendFeedbackCheckbox
  Var TahosappUninstallRemoveDataCheckbox
  Var TahosappUninstallReason
  Var TahosappUninstallSendFeedbackState
  Var TahosappUninstallRemoveDataState
!endif

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customPageAfterChangeDir
  Page custom TahosappOptionsPageCreate TahosappOptionsPageLeave
!macroend

!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
  UninstPage custom un.TahosappUninstallSurveyCreate un.TahosappUninstallSurveyLeave
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
  !else
    Function un.TahosappUninstallSurveyCreate
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}

      !insertmacro MUI_HEADER_TEXT "Kaldırma geri bildirimi" "tahosapp'i neden kaldırdığını isteğe bağlı olarak paylaşabilirsin."

      ${NSD_CreateLabel} 0 0 100% 18u "Sana en uygun nedeni seç:"
      Pop $0

      ${NSD_CreateRadioButton} 0 20u 100% 12u "Teknik bir sorun yaşadım veya uygulama çalışmadı"
      Pop $TahosappUninstallTechnicalRadio
      ${NSD_CreateRadioButton} 0 36u 100% 12u "Performans ya da kaynak kullanımı sorunluydu"
      Pop $TahosappUninstallPerformanceRadio
      ${NSD_CreateRadioButton} 0 52u 100% 12u "İhtiyacım olan özellikler eksikti"
      Pop $TahosappUninstallFeaturesRadio
      ${NSD_CreateRadioButton} 0 68u 100% 12u "Artık kullanmıyorum"
      Pop $TahosappUninstallUnusedRadio
      ${NSD_CreateRadioButton} 0 84u 100% 12u "Gizlilik veya güvenlik nedeniyle"
      Pop $TahosappUninstallPrivacyRadio
      ${NSD_CreateRadioButton} 0 100u 100% 12u "Yeniden kuracağım"
      Pop $TahosappUninstallReinstallRadio
      ${NSD_CreateRadioButton} 0 116u 100% 12u "Diğer / belirtmek istemiyorum"
      Pop $TahosappUninstallOtherRadio
      ${NSD_SetState} $TahosappUninstallOtherRadio ${BST_CHECKED}

      ${NSD_CreateCheckbox} 0 140u 100% 12u "Seçtiğim nedeni anonim olarak tahosapp'e gönder"
      Pop $TahosappUninstallSendFeedbackCheckbox
      ${NSD_SetState} $TahosappUninstallSendFeedbackCheckbox ${BST_CHECKED}

      ${NSD_CreateCheckbox} 0 158u 100% 12u "Bu bilgisayardaki oturumumu, ayarlarımı ve önbelleği de sil"
      Pop $TahosappUninstallRemoveDataCheckbox
      ${NSD_SetState} $TahosappUninstallRemoveDataCheckbox ${BST_UNCHECKED}

      ${NSD_CreateLabel} 0 178u 100% 24u "Geri bildirim yalnızca seçilen neden ve uygulama sürümünden oluşur; hesap veya cihaz kimliği gönderilmez."
      Pop $0

      nsDialogs::Show
    FunctionEnd

    Function un.TahosappUninstallSurveyLeave
      StrCpy $TahosappUninstallReason "other"
      ${NSD_GetState} $TahosappUninstallTechnicalRadio $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TahosappUninstallReason "technical_problem"
      ${EndIf}
      ${NSD_GetState} $TahosappUninstallPerformanceRadio $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TahosappUninstallReason "performance"
      ${EndIf}
      ${NSD_GetState} $TahosappUninstallFeaturesRadio $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TahosappUninstallReason "missing_features"
      ${EndIf}
      ${NSD_GetState} $TahosappUninstallUnusedRadio $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TahosappUninstallReason "not_using"
      ${EndIf}
      ${NSD_GetState} $TahosappUninstallPrivacyRadio $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TahosappUninstallReason "privacy"
      ${EndIf}
      ${NSD_GetState} $TahosappUninstallReinstallRadio $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TahosappUninstallReason "reinstalling"
      ${EndIf}
      ${NSD_GetState} $TahosappUninstallSendFeedbackCheckbox $TahosappUninstallSendFeedbackState
      ${NSD_GetState} $TahosappUninstallRemoveDataCheckbox $TahosappUninstallRemoveDataState
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
  ${If} $TahosappUninstallSendFeedbackState == ${BST_CHECKED}
    nsExec::ExecToStack '"$SYSDIR\curl.exe" --silent --show-error --max-time 5 --request POST --data-urlencode "reason=$TahosappUninstallReason" --data-urlencode "version=${VERSION}" "https://api.tahosapp.com.tr/api/feedback/uninstall"'
    Pop $0
    Pop $1
  ${EndIf}
  ${If} $TahosappUninstallRemoveDataState == ${BST_CHECKED}
    RMDir /r "$APPDATA\tahosapp"
    RMDir /r "$APPDATA\Discord Clone"
  ${EndIf}
!macroend
