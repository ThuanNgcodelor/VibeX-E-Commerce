# FULL DOCKER INSTALLATION GUIDE

## 1. System Requirements
- Docker Desktop (Windows/Mac) or Docker Engine (Linux).
- Docker Compose.
- Minimum 8GB RAM (16GB Recommended).

## 2. Configuration Note
Before starting, check and modify the `docker-compose.yml` file if necessary:

- **Auth Service**: Update `GOOGLE_REDIRECT_URI`, `FACEBOOK_REDIRECT_URI` to match your domain/IP.
- **Stock Service**: Update `OLLAMA_BASE_URL` if using a different AI model source.
- **Payment Service**: Update `VNPAY_RETURN_URL`, `MOMO_RETURN_URL` to receive payment gateway responses.

## 3. Deployment Steps

### Step 1: Build and Run
Open your terminal in the project root directory and run:
```bash
docker-compose up -d --build
```
*Note: This command will automatically build images for all services and start them in the correct order.*

### Step 2: Check Status
Verify if all containers are running correctly:
```bash
docker-compose ps
```

### Step 3: Access the Application
- **Frontend**: http://localhost
- **Gateway (API)**: http://localhost:8080
- **Eureka Server (Service Management)**: http://localhost:8761
- **Adminer (Database Management)**: http://localhost:8085 (Server: mysql, User: sa, Pass: Thuan@417)
- **Kafka UI**: http://localhost:9090

## 4. Maintenance and Debugging
- **View all logs**: `docker-compose logs -f`
- **View logs for a specific service**: `docker-compose logs -f [service_name]` (Example: `gateway`)
- **Stop the system**: `docker-compose down`
- **Update code after changes**: `docker-compose up -d --build [service_name]`
