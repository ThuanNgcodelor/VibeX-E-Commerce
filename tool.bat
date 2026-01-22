@echo off
REM ========================================
REM Docker Compose Restart Utility
REM ========================================

echo.
echo ========================================
echo   DOCKER COMPOSE RESTART DAVID NGUYEN
echo ========================================
echo.
echo Chon loai restart:
echo.
echo [1] Restart Nhanh (giu data)
echo [2] Rebuild All (code thay doi)
echo [3] Clean Toan Bo (loi cache nghiem trong - XOA DATA!)
echo [4] Restart 1 service cu the
echo [5] View logs
echo [0] Exit
echo.

set /p choice="Nhap lua chon (0-5): "

if "%choice%"=="1" goto restart_quick
if "%choice%"=="2" goto rebuild_all
if "%choice%"=="3" goto clean_all
if "%choice%"=="4" goto restart_service
if "%choice%"=="5" goto view_logs
if "%choice%"=="0" goto end

echo Lua chon khong hop le!
pause
goto end

:restart_quick
echo.
echo [1] Restart Nhanh...
docker-compose down
docker-compose up -d
echo.
echo Done! Kiem tra containers:
docker ps
pause
goto end

:rebuild_all
echo.
echo [2] Rebuild All...
docker-compose down
docker-compose up -d --build
echo.
echo Done! Kiem tra containers:
docker ps
pause
goto end

:clean_all
echo.
echo ==================== CANH BAO ====================
echo OPTION NAY SE XOA HET:
echo  - Containers
echo  - Volumes (DATABASE DATA!)
echo  - Networks
echo  - Images
echo ==================================================
echo.
set /p confirm="Ban co chac chan? (Y/N): "
if /i not "%confirm%"=="Y" goto end

echo.
echo [3] Clean Toan Bo...
docker-compose down -v --rmi all
docker-compose up -d --build --force-recreate
echo.
echo Done! Kiem tra containers:
docker ps
pause
goto end

:restart_service
echo.
echo Nhap ten service can restart (vd: payment-service, auth-service, gateway):
set /p service="Service name: "

echo.
echo Restarting %service%...
docker-compose stop %service%
docker-compose rm -f %service%
docker-compose up -d --build %service%

echo.
echo Done! Kiem tra:
docker logs %service% --tail 20
pause
goto end

:view_logs
echo.
echo [5] View Logs
echo.
echo [1] Tat ca services
echo [2] 1 service cu the
set /p log_choice="Chon (1-2): "

if "%log_choice%"=="1" (
    docker-compose logs -f --tail 50
) else (
    set /p service="Service name: "
    docker logs -f !service! --tail 100
)
goto end

:end
echo.
pause
