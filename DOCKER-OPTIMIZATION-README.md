# Docker Optimization for 8GB RAM 🚀

## Tổng Quan

Tối ưu hóa Docker Compose cho máy **i5 2500 8GB RAM** - giảm RAM từ **7.8GB → 5.5GB** (-29%).

## Quick Start

### Lần Đầu Khởi Động (Khuyến Nghị) ⭐

```batch
# Sử dụng staged startup để tránh lag
install.bat
```

### Development Nhanh

```batch
# Chỉ chạy minimal environment (~3.5GB)
tool-advanced.bat → Chọn [6]
```

### Restart & Rebuild

```batch
# Restart nhanh (giữ data)
tool.bat → Chọn [1]

# Rebuild sau khi sửa code
tool.bat → Chọn [2]
```

## Files Mới

| File | Mô Tả | RAM Usage |
|------|-------|-----------|
| `docker-compose.yml` | **Optimized** - Full stack | ~5.5GB |
| `docker-compose.minimal.yml` | Minimal environment | ~3.5GB |
| `install.bat` | Staged startup (5 giai đoạn) | - |
| `tool-advanced.bat` | Advanced tool (10 options) | - |
| `docker-compose.backup.yml` | Backup cấu hình cũ | - |

## RAM Usage Comparison

| Component | Before | After | Savings |
|-----------|--------|-------|---------|
| Infrastructure | 3.3GB | 2.2GB | -1.1GB |
| Spring Services | 4.2GB | 3.1GB | -1.1GB |
| Frontend | 256MB | 192MB | -64MB |
| **TOTAL** | **7.8GB** | **5.5GB** | **-2.3GB** ✅ |

## Tools

### 1. install.bat - Staged Startup

Khởi động services theo 5 giai đoạn (tổng ~2 phút):

```
Stage 1: Infrastructure (zookeeper, kafka, redis, mysql)
Stage 2: Spring Cloud Core (config-server, eureka-server)  
Stage 3: Backend Services (6 services)
Stage 4: Gateway
Stage 5: Frontend
```

### 2. tool-advanced.bat - Advanced Features

10 tính năng:
- [1-5] Standard features (restart, rebuild, logs...)
- **[6] Minimal Environment** (~3.5GB)
- **[7] Full Stack - Staged**
- **[8] Monitor Resources** (docker stats)
- **[9] Health Check All Services**
- **[10] Build Without Cache**

## Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:80 |
| API Gateway | http://localhost:8080 |
| Eureka Dashboard | http://localhost:8761 |
| Config Server | http://localhost:8888 |
| Kafka UI | http://localhost:9090 |
| Adminer (MySQL) | http://localhost:8085 |

## Troubleshooting

### Máy vẫn bị lag?

1. Dùng minimal environment:
   ```batch
   tool-advanced.bat → [6]
   ```

2. Tắt services không cần thiết:
   ```batch
   docker-compose stop kafka-ui adminer
   # Saves ~450MB RAM
   ```

3. Restart máy và đóng ứng dụng khác

### Service bị OOM kill (code 137)?

- Check logs: `docker logs <service-name>`
- Tăng memory limit thêm 100MB trong `docker-compose.yml`

### Build fails?

```batch
tool-advanced.bat → [10] Build Without Cache
```

## Rollback

Nếu có vấn đề, quay lại cấu hình cũ:

```batch
docker-compose down
copy /Y docker-compose.backup.yml docker-compose.yml
docker-compose up -d --build
```

## Documentation

- [Implementation Plan](C:\Users\ADMIN\.gemini\antigravity\brain\ae0ceb62-e7cf-4f25-abb6-ebeef9f39d4b\implementation_plan.md) - Chi tiết thay đổi
- [Walkthrough](C:\Users\ADMIN\.gemini\antigravity\brain\ae0ceb62-e7cf-4f25-abb6-ebeef9f39d4b\walkthrough.md) - Hướng dẫn đầy đủ
- [Task List](C:\Users\ADMIN\.gemini\antigravity\brain\ae0ceb62-e7cf-4f25-abb6-ebeef9f39d4b\task.md) - Checklist

## Tips

💡 **Lần đầu khởi động:** Dùng `install.bat`  
💡 **Develop frontend only:** Dùng minimal environment  
💡 **Monitor RAM:** `docker stats`  
💡 **Health check:** `tool-advanced.bat` → [9]

---

**Note:** Cấu hình này dành cho **development**. Production cần tăng RAM limits.
