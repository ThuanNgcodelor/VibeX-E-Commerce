@echo off
REM ========================================
REM Docker Compose STAGED STARTUP
REM Optimized for 8GB RAM machines
REM ========================================

echo.
echo ========================================
echo   DOCKER STAGED STARTUP - 8GB RAM
echo ========================================
echo.
echo Cai dat toan bo he thong theo tung giai doan
echo De tranh lag va CPU spike khi start container
echo.
echo Tong thoi gian du kien: 2-3 phut
echo.
set /p confirm="Ban co muon tiep tuc? (Y/N): "
if /i not "%confirm%"=="Y" goto end

echo.
echo ========================================
echo   STAGE 1: INFRASTRUCTURE SERVICES
echo ========================================
echo Khoi dong: Zookeeper, Kafka, Redis, MySQL
echo Thoi gian: ~30-45s
echo.

docker-compose up -d zookeeper kafka redis mysql

echo.
echo Cho Zookeeper va MySQL khoi dong...
timeout /t 15 /nobreak >nul

echo Kiem tra health checks...
timeout /t 15 /nobreak >nul

echo.
echo Infrastructure services status:
docker ps --filter "name=zookeeper" --filter "name=kafka" --filter "name=redis" --filter "name=mysql" --format "table {{.Names}}\t{{.Status}}"

echo.
echo ========================================
echo   STAGE 2: SPRING CLOUD CORE
echo ========================================
echo Khoi dong: Config Server, Eureka Server
echo Thoi gian: ~20-30s
echo.

docker-compose up -d config-server

echo.
echo Cho Config Server khoi dong...
timeout /t 20 /nobreak >nul

docker-compose up -d eureka-server

echo.
echo Cho Eureka Server khoi dong...
timeout /t 20 /nobreak >nul

echo.
echo Spring Cloud Core status:
docker ps --filter "name=config-server" --filter "name=eureka-server" --format "table {{.Names}}\t{{.Status}}"

echo.
echo ========================================
echo   STAGE 3: BACKEND SERVICES (6 services)
echo ========================================
echo Khoi dong: Auth, User, Stock, Order, Notification, Payment, File-Storage
echo Thoi gian: ~30-40s
echo.

REM Khoi dong 3 services dau tien
docker-compose up -d auth-service user-service stock-service

echo.
echo Cho batch 1 khoi dong (15s)...
timeout /t 15 /nobreak >nul

REM Khoi dong 3 services con lai
docker-compose up -d order-service notification-service payment-service

echo.
echo Cho batch 2 khoi dong (15s)...
timeout /t 15 /nobreak >nul

REM File storage service
docker-compose up -d file-storage

echo.
echo Cho file-storage khoi dong (10s)...
timeout /t 10 /nobreak >nul

echo.
echo Backend services status:
docker ps --filter "name=auth-service" --filter "name=user-service" --filter "name=stock-service" --filter "name=order-service" --filter "name=notification-service" --filter "name=payment-service" --filter "name=file-storage" --format "table {{.Names}}\t{{.Status}}"

echo.
echo ========================================
echo   STAGE 4: API GATEWAY
echo ========================================
echo Khoi dong: Gateway
echo Thoi gian: ~15-20s
echo.

docker-compose up -d gateway

echo.
echo Cho Gateway khoi dong...
timeout /t 20 /nobreak >nul

echo.
echo Gateway status:
docker ps --filter "name=gateway" --format "table {{.Names}}\t{{.Status}}"

echo.
echo ========================================
echo   STAGE 5: FRONTEND & NGINX
echo ========================================
echo Khoi dong: nginx-rtmp, my-app
echo Thoi gian: ~10s
echo.

docker-compose up -d nginx-rtmp my-app

echo.
echo Cho frontend khoi dong...
timeout /t 10 /nobreak >nul

echo.
echo Frontend status:
docker ps --filter "name=nginx-rtmp" --filter "name=my-app" --format "table {{.Names}}\t{{.Status}}"

echo.
echo ========================================
echo   HOAN THANH CAI DAT!
echo ========================================
echo.
echo Tat ca services da duoc khoi dong thanh cong!
echo.
echo Kiem tra toan bo containers:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo ========================================
echo   THONG TIN TRUY CAP
echo ========================================
echo.
echo Frontend App:        http://localhost:80
echo Eureka Dashboard:    http://localhost:8761
echo Config Server:       http://localhost:8888
echo API Gateway:         http://localhost:8080
echo Kafka UI:            http://localhost:9090
echo Adminer (MySQL):     http://localhost:8085
echo Nginx RTMP:          rtmp://localhost:1935
echo.
echo ========================================
echo   LENH QUAN TRONG
echo ========================================
echo.
echo Kiem tra logs:       docker-compose logs -f [service-name]
echo Xem RAM usage:       docker stats
echo Stop tat ca:         docker-compose down
echo Rebuild service:     docker-compose up -d --build [service-name]
echo.

:end
echo.
pause
