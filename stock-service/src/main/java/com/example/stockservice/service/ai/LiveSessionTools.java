package com.example.stockservice.service.ai;

import com.example.stockservice.client.NotificationServiceClient;
import com.example.stockservice.dto.LiveProductDto;
import com.example.stockservice.dto.LiveRoomDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Description;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Live Session Tools for AI Function Calling
 * Cho phép AI tìm kiếm và gợi ý phiên live streaming
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LiveSessionTools {

    private final NotificationServiceClient notificationServiceClient;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // ============ Request/Response Records ============

    public record GetActiveLiveSessionsRequest(Integer limit) {
    }

    public record GetActiveLiveSessionsResponse(List<LiveSessionInfo> liveSessions, int total, String message) {
    }

    public record SearchLiveByKeywordRequest(String keyword) {
    }

    public record SearchLiveByKeywordResponse(List<LiveSessionInfo> liveSessions, String message) {
    }

    public record GetLiveDetailsRequest(String roomId) {
    }

    public record GetLiveDetailsResponse(LiveSessionDetail liveSession, boolean found, String message) {
    }

    public record LiveSessionInfo(
            String roomId,
            String shopName,
            String title,
            String description,
            int viewerCount,
            int productCount,
            String thumbnailUrl) {
    }

    public record LiveSessionDetail(
            String roomId,
            String shopName,
            String title,
            String description,
            int viewerCount,
            int totalOrders,
            String totalRevenue,
            String startedAt,
            List<LiveProductInfo> products) {
    }

    public record LiveProductInfo(
            String productId,
            String productName,
            String originalPrice,
            String livePrice,
            String discountPercent,
            int remainingQuantity,
            boolean isOutOfStock) {
    }

    // ============ Tool Functions ============

    /**
     * Lấy tất cả phiên live đang hoạt động
     */
    @Description("Get all active live streaming sessions. Use when user asks about current live streams, live shopping.")
    public Function<GetActiveLiveSessionsRequest, GetActiveLiveSessionsResponse> getActiveLiveSessions() {
        return request -> {
            log.info("=== Tool called: getActiveLiveSessions(limit={}) ===", request.limit());

            try {
                int limit = request.limit() != null ? request.limit() : 10;

                ResponseEntity<List<LiveRoomDto>> response = notificationServiceClient.getActiveLiveRooms(1, limit);

                if (response.getBody() == null || response.getBody().isEmpty()) {
                    return new GetActiveLiveSessionsResponse(
                            List.of(),
                            0,
                            "Hiện tại không có phiên live nào đang hoạt động.");
                }

                List<LiveRoomDto> liveRooms = response.getBody();

                // Filter only LIVE status
                List<LiveSessionInfo> liveSessions = liveRooms.stream()
                        .filter(room -> "LIVE".equals(room.getStatus()))
                        .map(this::toLiveSessionInfo)
                        .collect(Collectors.toList());

                if (liveSessions.isEmpty()) {
                    return new GetActiveLiveSessionsResponse(
                            List.of(),
                            0,
                            "Hiện tại không có phiên live nào đang hoạt động.");
                }

                StringBuilder message = new StringBuilder();
                message.append("📺 **Có ").append(liveSessions.size()).append(" phiên live đang hoạt động:**\n\n");
                for (LiveSessionInfo live : liveSessions) {
                    message.append("• **").append(live.shopName()).append("**: ").append(live.title()).append("\n");
                    message.append("  - Người xem: ").append(live.viewerCount()).append("\n");
                    message.append("  - Sản phẩm: ").append(live.productCount()).append(" sản phẩm\n");
                    if (live.description() != null && !live.description().isBlank()) {
                        String truncatedDesc = live.description().length() > 100
                                ? live.description().substring(0, 100) + "..."
                                : live.description();
                        message.append("  - Mô tả: ").append(truncatedDesc).append("\n");
                    }
                    message.append("\n");
                }

                log.info("Found {} active live sessions", liveSessions.size());
                return new GetActiveLiveSessionsResponse(liveSessions, liveSessions.size(), message.toString());

            } catch (Exception e) {
                log.error("Error getting active live sessions: ", e);
                return new GetActiveLiveSessionsResponse(
                        List.of(),
                        0,
                        "Không thể lấy danh sách phiên live. Vui lòng thử lại sau.");
            }
        };
    }

    /**
     * Tìm phiên live theo từ khóa (title, description, shop name)
     */
    @Description("Search live sessions by keyword (title, shop name, description). Use when user searches for specific live content.")
    public Function<SearchLiveByKeywordRequest, SearchLiveByKeywordResponse> searchLiveByKeyword() {
        return request -> {
            log.info("=== Tool called: searchLiveByKeyword(keyword={}) ===", request.keyword());

            if (request.keyword() == null || request.keyword().isBlank()) {
                return new SearchLiveByKeywordResponse(
                        List.of(),
                        "Vui lòng cung cấp từ khóa để tìm kiếm.");
            }

            try {
                String keyword = request.keyword().toLowerCase();

                ResponseEntity<List<LiveRoomDto>> response = notificationServiceClient.getActiveLiveRooms(1, 50);

                if (response.getBody() == null || response.getBody().isEmpty()) {
                    return new SearchLiveByKeywordResponse(
                            List.of(),
                            "Không tìm thấy phiên live nào.");
                }

                // Filter by keyword
                List<LiveSessionInfo> matchedLives = response.getBody().stream()
                        .filter(room -> "LIVE".equals(room.getStatus()))
                        .filter(room -> (room.getTitle() != null && room.getTitle().toLowerCase().contains(keyword)) ||
                                (room.getDescription() != null && room.getDescription().toLowerCase().contains(keyword))
                                ||
                                (room.getShopName() != null && room.getShopName().toLowerCase().contains(keyword)))
                        .map(this::toLiveSessionInfo)
                        .collect(Collectors.toList());

                if (matchedLives.isEmpty()) {
                    return new SearchLiveByKeywordResponse(
                            List.of(),
                            "Không tìm thấy phiên live nào với từ khóa '" + request.keyword() + "'.");
                }

                StringBuilder message = new StringBuilder();
                message.append("🔍 **Tìm thấy ").append(matchedLives.size()).append(" phiên live:**\n\n");
                for (LiveSessionInfo live : matchedLives) {
                    message.append("• **").append(live.shopName()).append("**: ").append(live.title()).append("\n");
                    message.append("  - Người xem: ").append(live.viewerCount()).append("\n");
                    message.append("  - Sản phẩm: ").append(live.productCount()).append("\n\n");
                }

                log.info("Found {} live sessions matching keyword '{}'", matchedLives.size(), request.keyword());
                return new SearchLiveByKeywordResponse(matchedLives, message.toString());

            } catch (Exception e) {
                log.error("Error searching live sessions: ", e);
                return new SearchLiveByKeywordResponse(
                        List.of(),
                        "Không thể tìm kiếm phiên live.");
            }
        };
    }

    /**
     * Lấy chi tiết phiên live (bao gồm sản phẩm)
     */
    @Description("Get detailed information of a live session including products. Use when user wants details about a specific live.")
    public Function<GetLiveDetailsRequest, GetLiveDetailsResponse> getLiveDetails() {
        return request -> {
            log.info("=== Tool called: getLiveDetails(roomId={}) ===", request.roomId());

            if (request.roomId() == null || request.roomId().isBlank()) {
                return new GetLiveDetailsResponse(
                        null,
                        false,
                        "Vui lòng cung cấp ID phiên live.");
            }

            try {
                ResponseEntity<LiveRoomDto> response = notificationServiceClient.getLiveRoom(request.roomId());

                if (response.getBody() == null) {
                    return new GetLiveDetailsResponse(
                            null,
                            false,
                            "Không tìm thấy phiên live với ID: " + request.roomId());
                }

                LiveRoomDto room = response.getBody();
                LiveSessionDetail detail = toLiveSessionDetail(room);

                StringBuilder message = new StringBuilder();
                message.append("📺 **Chi tiết phiên live:**\n\n");
                message.append("🏪 Shop: **").append(detail.shopName()).append("**\n");
                message.append("📌 Tiêu đề: ").append(detail.title()).append("\n");
                if (detail.startedAt() != null) {
                    message.append("⏰ Bắt đầu: ").append(detail.startedAt()).append("\n");
                }
                message.append("👥 Người xem: ").append(detail.viewerCount()).append("\n");
                message.append("🛍️ Đơn hàng: ").append(detail.totalOrders()).append("\n");
                message.append("💰 Doanh thu: ").append(detail.totalRevenue()).append("\n\n");

                if (!detail.products().isEmpty()) {
                    message.append("**Sản phẩm đang bán:**\n");
                    for (LiveProductInfo product : detail.products()) {
                        message.append("• ").append(product.productName()).append("\n");
                        message.append("  - Giá live: ").append(product.livePrice());
                        if (product.discountPercent() != null) {
                            message.append(" (giảm ").append(product.discountPercent()).append(")");
                        }
                        message.append("\n");
                        message.append("  - Còn lại: ").append(product.remainingQuantity()).append("\n");
                    }
                }

                log.info("Retrieved details for live room {}", request.roomId());
                return new GetLiveDetailsResponse(detail, true, message.toString());

            } catch (Exception e) {
                log.error("Error getting live details: ", e);
                return new GetLiveDetailsResponse(
                        null,
                        false,
                        "Không thể lấy thông tin phiên live.");
            }
        };
    }

    // ============ Helper Methods ============

    private LiveSessionInfo toLiveSessionInfo(LiveRoomDto room) {
        int productCount = room.getProducts() != null ? room.getProducts().size() : 0;

        return new LiveSessionInfo(
                room.getId(),
                room.getShopName() != null ? room.getShopName() : "Shop",
                room.getTitle(),
                room.getDescription(),
                room.getViewerCount() != null ? room.getViewerCount() : 0,
                productCount,
                room.getThumbnailUrl());
    }

    private LiveSessionDetail toLiveSessionDetail(LiveRoomDto room) {
        List<LiveProductInfo> products = room.getProducts() != null
                ? room.getProducts().stream()
                        .map(this::toLiveProductInfo)
                        .collect(Collectors.toList())
                : List.of();

        String startedAt = room.getStartedAt() != null
                ? room.getStartedAt().format(DATE_FORMAT)
                : null;

        return new LiveSessionDetail(
                room.getId(),
                room.getShopName() != null ? room.getShopName() : "Shop",
                room.getTitle(),
                room.getDescription(),
                room.getViewerCount() != null ? room.getViewerCount() : 0,
                room.getTotalOrders() != null ? room.getTotalOrders() : 0,
                formatPrice(room.getTotalRevenue()),
                startedAt,
                products);
    }

    private LiveProductInfo toLiveProductInfo(LiveProductDto product) {
        return new LiveProductInfo(
                product.getProductId(),
                product.getProductName(),
                formatPrice(product.getOriginalPrice()),
                formatPrice(product.getLivePrice()),
                product.getDiscountPercent() != null ? String.format("%.0f%%", product.getDiscountPercent()) : null,
                product.getRemainingQuantity() != null ? product.getRemainingQuantity() : 0,
                product.getIsOutOfStock() != null ? product.getIsOutOfStock() : false);
    }

    private String formatPrice(Double price) {
        if (price == null || price == 0)
            return "0₫";
        return String.format("%,.0f₫", price);
    }
}
