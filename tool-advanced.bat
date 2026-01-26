@echo off
REM ========================================
REM Docker Compose Advanced Tool
REM Extended features for 8GB RAM optimization
REM ========================================

echo.
echo ========================================
echo   DOCKER ADVANCED TOOL - 8GB RAM
echo ========================================
echo.
echo Chon chuc nang:\
echo.
echo [1] Restart Nhanh (giu data)
echo [2] Rebuild All (code thay doi)
echo [3] Clean Toan Bo (loi cache - XOA DATA!)
echo [4] Restart 1 service cu the
echo [5] View logs
echo.
echo === ADVANCED OPTIONS ===
echo [6] Start Minimal Environment (3.5GB RAM)
echo [7] Start Full Stack - Staged (5.5GB RAM)
echo [8] Monitor Resource Usage (Docker Stats)
echo [9] Health Check All Services
echo [10] Build Without Cache (fix build issues)
echo.
echo [0] Exit
echo.

set /p choice="Nhap lua chon (0-10): "

if "%choice%"=="1" goto restart_quick
if "%choice%"=="2" goto rebuild_all
if "%choice%"=="3" goto clean_all
if "%choice%"=="4" goto restart_service
if "%choice%"=="5" goto view_logs
if "%choice%"=="6" goto minimal_env
if "%choice%"=="7" goto staged_startup
if "%choice%"=="8" goto monitor_resources
if "%choice%"=="9" goto health_check
if "%choice%"=="10" goto build_no_cache
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

:minimal_env
echo.
echo ========================================
echo   [6] MINIMAL ENVIRONMENT
echo ========================================
echo.
echo RAM usage: ~3.5GB (thay vi 5.5GB)
echo Bao gom:
echo   - Infrastructure: MySQL, Redis, Kafka, Zookeeper
echo   - Core: config-server, eureka-server, gateway
echo   - Services: auth-service, user-service
echo   - Frontend: my-app
echo.
set /p confirm="Ban co muon start minimal environment? (Y/N): "
if /i not "%confirm%"=="Y" goto end

echo.
echo Stopping full stack...
docker-compose down

echo.
echo Starting minimal environment...
docker-compose -f docker-compose.minimal.yml up -d --build

echo.
echo Minimal environment started!
echo.
docker ps --format "table {{.Names}}\t{{.Status}}"
echo.
echo Truy cap:
echo   - Frontend: http://localhost:80
echo   - Gateway: http://localhost:8080
echo   - Eureka: http://localhost:8761
pause
goto end

:staged_startup
echo.
echo ========================================
echo   [7] FULL STACK - STAGED STARTUP
echo ========================================
echo.
echo Se chay install.bat de khoi dong toan bo services
echo theo tung giai doan (tong thoi gian: 2-3 phut)
echo.
set /p confirm="Ban co muon tiep tuc? (Y/N): "
if /i not "%confirm%"=="Y" goto end

echo.
echo Stopping existing containers...
docker-compose down

echo.
echo Starting staged startup...
call install.bat
goto end

:monitor_resources
echo.
echo ========================================
echo   [8] MONITOR RESOURCE USAGE
echo ========================================
echo.
echo Hien thi RAM va CPU usage cua tat ca containers
echo Nhan Ctrl+C de thoat
echo.
pause
docker stats
goto end

:health_check
echo.
echo ========================================
echo   [9] HEALTH CHECK ALL SERVICES
echo ========================================
echo.
echo Kiem tra trang thai cua tat ca services...
echo.

echo === INFRASTRUCTURE ===
echo.
echo [MySQL]
docker exec mysql mysqladmin ping -h localhost -u root -proot 2>nul && echo OK || echo FAILED
echo.
echo [Redis]
docker exec redis redis-cli ping 2>nul && echo OK || echo FAILED
echo.
echo [Kafka]
docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 2>nul >nul && echo OK || echo FAILED
echo.

echo === SPRING CLOUD ===
echo.
echo [Config Server]
curl -s http://localhost:8888/actuator/health 2>nul | find "UP" >nul && echo OK || echo FAILED
echo.
echo [Eureka Server]
curl -s http://localhost:8761/actuator/health 2>nul | find "UP" >nul && echo OK || echo FAILED
echo.
echo [Gateway]
curl -s http://localhost:8080/actuator/health 2>nul | find "UP" >nul && echo OK || echo FAILED
echo.

echo === BACKEND SERVICES ===
echo.
for %%s in (auth-service user-service stock-service order-service notification-service payment-service file-storage) do (
    echo [%%s]
    docker ps --filter "name=%%s" --filter "status=running" --format "{{.Names}}" | find "%%s" >nul && echo OK || echo FAILED
    echo.
)

echo.
echo Health check completed!
pause
goto end

:build_no_cache
echo.
echo ========================================
echo   [10] BUILD WITHOUT CACHE
echo ========================================
echo.
echo CANH BAO: Se build lai tat ca images tu dau
echo Thoi gian: 5-10 phut
echo.
set /p confirm="Ban co muon tiep tuc? (Y/N): "
if /i not "%confirm%"=="Y" goto end

echo.
echo Building without cache...
docker-compose build --no-cache

echo.
echo Starting services...
docker-compose up -d

echo.
echo Done!
docker ps
pause
goto end

:end
echo.
pause
