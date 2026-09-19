@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0..\.."

if "%~1"=="" (
  echo.
  echo   정리할 폴더를 이 파일 위로 끌어다 놓으십시오.
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
echo   정리계획만 만듭니다. 아무것도 옮기거나 지우지 아니합니다.
echo.
node "사건관리\정리.js" "%~1"
echo.
echo   대상 폴더의 정리계획.csv를 열어 확인하십시오.
echo.
pause
