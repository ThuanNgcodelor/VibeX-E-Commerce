# 2. List out all Hardware and Software required for implementing the project:

|  | **Server** | **Client** |
|:---|:-----------|:-----------|
| **Hardware** | <ul><li>**CPU:** 8 cores (Intel Xeon / AMD EPYC)</li><li>**RAM:** 16 GB DDR4</li><li>**Storage:** 100 GB SSD NVMe</li><li>**Network:** 1 Gbps Ethernet</li><li>**OS:** Linux Ubuntu Server 20.04 LTS</li></ul> | <ul><li>**CPU:** Dual-core 2.0 GHz or higher</li><li>**RAM:** 4 GB minimum, 8 GB recommended</li><li>**Storage:** 2 GB free disk space</li><li>**Screen:** 1366x768 minimum resolution</li><li>**Internet:** 5 Mbps minimum, 20+ Mbps recommended</li></ul> |
| **Software** | <ul><li>**Docker:** 24.x+ (containerization)</li><li>**Docker Compose:** 2.x+ (orchestration)</li><li>**Java JDK:** 21 (OpenJDK)</li><li>**MySQL:** 8.0 (database)</li><li>**Apache Kafka:** 7.6.1 (message broker)</li><li>**Redis:** 7.x (cache)</li><li>**Maven:** 3.8+ (build tool)</li><li>**Git:** 2.x+ (version control)</li></ul> | <ul><li>**Web Browser:** Chrome / Edge / Firefox / Safari (latest versions)</li><li>**Node.js:** 18.x / 20.x (for developers only)</li><li>**npm:** 9.x+ (package manager)</li></ul> |
| **Additional Technology** | <ul><li>**Spring Boot:** 3.3.12</li><li>**Spring Cloud:** 2023.0.3 (Eureka, Config, Gateway, OpenFeign)</li><li>**Spring Security + JWT:** Authentication & Authorization</li><li>**Spring Data JPA:** ORM layer</li><li>**Spring Kafka:** Event streaming</li><li>**Zookeeper:** 7.6.1 (Kafka coordination)</li><li>**NGINX-RTMP:** Livestream server</li><li>**Kafka UI:** Web-based monitoring</li><li>**SpringDoc OpenAPI:** 2.2.0 (API documentation)</li><li>**Spring AI (Ollama):** 1.0.0-M4 (AI features)</li></ul> | <ul><li>**React:** 18.3.1 (UI library)</li><li>**Vite:** 7.0.4 (build tool)</li><li>**React Router:** 6.20.0 (routing)</li><li>**Axios:** 1.6.0 (HTTP client)</li><li>**Bootstrap:** 5.3.2 + React Bootstrap 2.9.0</li><li>**i18next:** 25.7.2 (internationalization vi/en)</li><li>**WebSocket:** SockJS 1.6.1 + STOMP 7.2.1 (real-time)</li><li>**Chart.js:** 4.5.0 (analytics charts)</li><li>**Leaflet / Google Maps API:** Maps integration</li><li>**HLS.js:** 1.6.15 (livestream playback)</li></ul> |

---

## Network Configuration

**Server Ports:**
- Gateway: 8080 (main entry point)
- Eureka: 8761, Config: 8888
- MySQL: 3306, Redis: 6379, Kafka: 9092/9094
- Microservices: 8081-8087
- NGINX-RTMP: 1935 (RTMP), 8088 (HLS)

**Security:** HTTPS (SSL/TLS), JWT authentication, firewall rules, CORS configuration