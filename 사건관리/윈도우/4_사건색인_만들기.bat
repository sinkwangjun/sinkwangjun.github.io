@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0..\.."

if "%~1"=="" (
  echo.
  echo   색인을 만들 폴더를 이 파일 위로 끌어다 놓으십시오.
  echo   사무소 자료 폴더 전체를 놓으셔도 됩니다.
  echo.
  pause
  exit /b
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js가 설치되어 있지 아니합니다.
  echo   https://nodejs.org 에서 LTS 판을 내려받아 설치하신 다음 다시 실행하십시오.
  echo.
  pause
  exit /b
)

echo.
echo   폴더 이름의 사건번호를 찾아 색인을 만듭니다.
echo   읽기만 합니다. 아무것도 옮기거나 지우지 아니합니다.
echo.
node "사건관리\색인.js" "%~1"
echo.
echo   대상 폴더의 사건색인.csv를 엑셀로 여시면 의뢰인 이름으로 바로 찾으실 수 있습니다.
echo.
pause
