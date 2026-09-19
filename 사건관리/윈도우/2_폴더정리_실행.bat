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
echo   대상: %~1
echo   정리계획대로 파일을 표준 폴더로 옮깁니다.
echo   먼저 1_폴더정리_계획보기.bat 으로 정리계획.csv를 확인하셨습니까?
echo.
set /p 확인=  계속하려면 Y 를 입력하고 Enter 를 누르십시오:
if /i not "%확인%"=="Y" (
  echo.
  echo   취소하였습니다.
  echo.
  pause
  exit /b
)

node "사건관리\정리.js" "%~1" --실행
echo.
pause
