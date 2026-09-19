@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0..\.."

if "%~1"=="" (
  echo.
  echo   검사할 폴더를 이 파일 위로 끌어다 놓으십시오.
  echo   원드라이브 폴더를 그대로 놓으셔도 됩니다.
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
echo   파일의 내용을 대조하여 완전히 같은 것만 찾습니다.
echo   보고서만 만들고 아무것도 지우지 아니합니다.
echo.
node "사건관리\중복찾기.js" "%~1"
echo.
echo   대상 폴더의 중복보고서.csv를 열어 확인하십시오.
echo   중복본을 따로 빼두시려면 명령 프롬프트에서 아래를 실행하십시오.
echo     node "사건관리\중복찾기.js" "폴더경로" --격리 "D:\중복격리"
echo.
pause
