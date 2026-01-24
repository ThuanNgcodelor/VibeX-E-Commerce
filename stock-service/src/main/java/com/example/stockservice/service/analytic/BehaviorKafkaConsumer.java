package com.example.stockservice.service.analytic;

import com.example.stockservice.dto.analytics.BehaviorEventDto;
import com.example.stockservice.enums.EventType;
import com.example.stockservice.model.analytics.BehaviorLog;
import com.example.stockservice.model.analytics.ProductAnalytics;
import com.example.stockservice.model.analytics.SearchAnalytics;
import com.example.stockservice.repository.analytics.BehaviorLogRepository;
import com.example.stockservice.repository.analytics.ProductAnalyticsRepository;
import com.example.stockservice.repository.analytics.SearchAnalyticsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * ===== PHASE 1: KAFKA CONSUMER =====
 * 
 * Consumer xử lý behavior events từ Kafka và lưu vào MySQL
 * Lắng nghe topic: analytics-topic
 * BẢNG MYSQL ĐƯỢC CẬP NHẬT:
 * 1. behavior_logs - Log chi tiết từng sự kiện
 * Mỗi event tạo 1 record mới
 * 2. product_analytics - Thống kê tổng hợp theo sản phẩm
 * Chứa: viewCount, cartCount, purchaseCount, conversionRate
 * Cập nhật khi có event VIEW, ADD_CART, PURCHASE
 * 3. search_analytics - Thống kê tìm kiếm theo ngày
 * Chứa: keyword, date, searchCount
 * Cập nhật khi có event SEARCH
 * Kafka (analytics-topic) → Consumer.consume() → MySQL (3 bảng)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BehaviorKafkaConsumer {

    private final BehaviorLogRepository behaviorLogRepository;
    private final ProductAnalyticsRepository productAnalyticsRepository;
    private final SearchAnalyticsRepository searchAnalyticsRepository;

    /**
     * Lắng nghe và xử lý behavior events từ Kafka
     * 
     * Cấu hình:
     * - topics: analytics-topic
     * - groupId: stock-service-analytics (đảm bảo chỉ 1 consumer xử lý mỗi message)
     * - containerFactory: dùng cho concurrent processing
     * 
     * Hoạt động khi nhận event:
     * 1. Lưu behavior log chi tiết
     * 2. Cập nhật product analytics (nếu có productId)
     * 3. Cập nhật search analytics (nếu có keyword)
     */
    @KafkaListener(topics = "${kafka.topic.analytics:analytics-topic}", groupId = "${spring.kafka.consumer.group-id:stock-service}-analytics", containerFactory = "analyticsKafkaListenerContainerFactory")
    @Transactional
    public void consume(BehaviorEventDto event) {
        try {
            log.debug("Nhận behavior event: type={}, productId={}",
                    event.getEventType(), event.getProductId());

            // Bước 1: Lưu log chi tiết (luôn thực hiện)
            saveBehaviorLog(event);

            // Bước 2: Cập nhật product analytics (nếu có productId)
            if (event.getProductId() != null) {
                updateProductAnalytics(event);
            }

            // Bước 3: Cập nhật search analytics (nếu là event SEARCH)
            if (event.getKeyword() != null && event.getEventType() == EventType.SEARCH) {
                updateSearchAnalytics(event);
            }

            log.debug("Đã xử lý behavior event thành công: {}", event.getEventId());

        } catch (Exception e) {
            log.error("Lỗi xử lý behavior event {}: {}", event.getEventId(), e.getMessage(), e);
            // Không throw exception - để Kafka commit offset, tránh retry vô hạn
        }
    }

    /**
     * Lưu log chi tiết hành vi vào bảng behavior_logs
     * 
     * Mỗi event tạo 1 record mới (append-only log)
     * Dùng để phân tích chi tiết sau này
     */
    private void saveBehaviorLog(BehaviorEventDto event) {
        BehaviorLog log = BehaviorLog.builder()
                .userId(event.getUserId())
                .sessionId(event.getSessionId())
                .eventType(event.getEventType())
                .productId(event.getProductId())
                .shopId(event.getShopId())
                .searchKeyword(event.getKeyword())
                .source(event.getSource())
                .durationSeconds(event.getDuration())
                .build();

        behaviorLogRepository.save(log);
    }

    /**
     * Cập nhật thống kê tổng hợp cho sản phẩm
     * 
     * Bảng: product_analytics
     * - VIEW: tăng viewCount, cập nhật lastViewedAt
     * - ADD_CART: tăng cartCount
     * - PURCHASE: tăng purchaseCount
     * - Tính lại conversionRate = (purchaseCount / viewCount) * 100
     */
    private void updateProductAnalytics(BehaviorEventDto event) {
        // Tìm hoặc tạo mới record analytics cho sản phẩm
        ProductAnalytics analytics = productAnalyticsRepository
                .findById(event.getProductId())
                .orElseGet(() -> ProductAnalytics.builder()
                        .productId(event.getProductId())
                        .shopId(event.getShopId())
                        .viewCount(0L)
                        .cartCount(0L)
                        .purchaseCount(0L)
                        .uniqueViewers(0L)
                        .conversionRate(0.0)
                        .build());

        // Cập nhật counters theo loại event
        switch (event.getEventType()) {
            case VIEW -> {
                analytics.setViewCount(analytics.getViewCount() + 1);
                analytics.setLastViewedAt(LocalDateTime.now());
            }
            case ADD_CART -> analytics.setCartCount(analytics.getCartCount() + 1);
            case PURCHASE -> analytics.setPurchaseCount(analytics.getPurchaseCount() + 1);
        }

        // Tính lại tỷ lệ chuyển đổi (conversion rate)
        // CVR = (Số đơn mua / Số lượt xem) * 100%
        if (analytics.getViewCount() > 0) {
            double cvr = (analytics.getPurchaseCount() * 100.0) / analytics.getViewCount();
            analytics.setConversionRate(Math.round(cvr * 100.0) / 100.0); // Làm tròn 2 chữ số
        }

        productAnalyticsRepository.save(analytics);
    }

    /**
     * Cập nhật thống kê tìm kiếm theo ngày
     * 
     * Bảng: search_analytics
     * - Nhóm theo: keyword + date
     * - Tăng searchCount mỗi khi có event SEARCH
     */
    private void updateSearchAnalytics(BehaviorEventDto event) {
        LocalDate today = LocalDate.now();
        String keyword = event.getKeyword().toLowerCase().trim();

        // Tìm hoặc tạo mới record cho keyword + ngày hôm nay
        SearchAnalytics analytics = searchAnalyticsRepository
                .findByKeywordAndDate(keyword, today)
                .orElseGet(() -> SearchAnalytics.builder()
                        .keyword(keyword)
                        .date(today)
                        .searchCount(0L)
                        .clickCount(0L)
                        .build());

        analytics.setSearchCount(analytics.getSearchCount() + 1);
        searchAnalyticsRepository.save(analytics);
    }
}
