#!/bin/bash

# ✅ Script để verify các tối ưu đã được apply
# Chạy: bash verify-optimization.sh

echo "=========================================="
echo "VERIFYING OPTIMIZATION CONFIGURATIONS"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Kafka Consumer Concurrency
echo "1. Checking Kafka Consumer Concurrency..."
echo "----------------------------------------"

NOTIF_CONCURRENCY=$(grep -r "setConcurrency" notification-service/src/ 2>/dev/null | grep -o "setConcurrency([0-9]*)" | grep -o "[0-9]*" | head -1)
if [ -z "$NOTIF_CONCURRENCY" ]; then
    echo -e "${RED}❌ Notification Service: setConcurrency not found${NC}"
elif [ "$NOTIF_CONCURRENCY" -ge 10 ]; then
    echo -e "${GREEN}✅ Notification Service: concurrency = $NOTIF_CONCURRENCY${NC}"
else
    echo -e "${YELLOW}⚠️  Notification Service: concurrency = $NOTIF_CONCURRENCY (should be >= 10)${NC}"
fi

ORDER_CONCURRENCY=$(grep -r "setConcurrency" order-service/src/ 2>/dev/null | grep -o "setConcurrency([0-9]*)" | grep -o "[0-9]*" | head -1)
if [ -z "$ORDER_CONCURRENCY" ]; then
    echo -e "${RED}❌ Order Service: setConcurrency not found${NC}"
elif [ "$ORDER_CONCURRENCY" -ge 10 ]; then
    echo -e "${GREEN}✅ Order Service: concurrency = $ORDER_CONCURRENCY${NC}"
else
    echo -e "${YELLOW}⚠️  Order Service: concurrency = $ORDER_CONCURRENCY (should be >= 10)${NC}"
fi

echo ""

# Check Database Pool Size
echo "2. Checking Database Connection Pool Size..."
echo "----------------------------------------"

POOL_SIZE=$(grep -r "hikari.maximum-pool-size" */src/main/resources/ 2>/dev/null | grep -o "[0-9]*" | head -1)
if [ -z "$POOL_SIZE" ]; then
    echo -e "${RED}❌ Database pool size not configured (using default 10)${NC}"
elif [ "$POOL_SIZE" -ge 20 ]; then
    echo -e "${GREEN}✅ Database pool size = $POOL_SIZE${NC}"
else
    echo -e "${YELLOW}⚠️  Database pool size = $POOL_SIZE (should be >= 20)${NC}"
fi

echo ""

# Check Tomcat Threads
echo "3. Checking Tomcat Thread Pool..."
echo "----------------------------------------"

TOMCAT_THREADS=$(grep -r "tomcat.threads.max" */src/main/resources/ 2>/dev/null | grep -o "[0-9]*" | head -1)
if [ -z "$TOMCAT_THREADS" ]; then
    echo -e "${RED}❌ Tomcat threads not configured (using default 200)${NC}"
elif [ "$TOMCAT_THREADS" -ge 500 ]; then
    echo -e "${GREEN}✅ Tomcat max threads = $TOMCAT_THREADS${NC}"
else
    echo -e "${YELLOW}⚠️  Tomcat max threads = $TOMCAT_THREADS (should be >= 500 for high traffic)${NC}"
fi

echo ""

# Check MySQL Configuration
echo "4. Checking MySQL Configuration..."
echo "----------------------------------------"
echo "Please run these SQL commands manually:"
echo "  mysql> SHOW VARIABLES LIKE 'max_connections';"
echo "  mysql> SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"
echo "  mysql> SHOW STATUS LIKE 'Threads_connected';"
echo "  mysql> SHOW STATUS LIKE 'Max_used_connections';"
echo ""

# Check Actuator
echo "5. Checking Spring Boot Actuator..."
echo "----------------------------------------"

ACTUATOR_ENABLED=$(grep -r "actuator" */pom.xml 2>/dev/null | wc -l)
if [ "$ACTUATOR_ENABLED" -gt 0 ]; then
    echo -e "${GREEN}✅ Actuator dependency found${NC}"
else
    echo -e "${YELLOW}⚠️  Actuator dependency not found${NC}"
fi

ACTUATOR_ENDPOINTS=$(grep -r "management.endpoints.web.exposure.include" */src/main/resources/ 2>/dev/null | wc -l)
if [ "$ACTUATOR_ENDPOINTS" -gt 0 ]; then
    echo -e "${GREEN}✅ Actuator endpoints configured${NC}"
else
    echo -e "${YELLOW}⚠️  Actuator endpoints not configured${NC}"
fi

echo ""
echo "=========================================="
echo "VERIFICATION COMPLETE"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Apply missing configurations"
echo "2. Restart services"
echo "3. Monitor metrics via Actuator"
echo "4. Run load tests"

