package com.example.stockservice.service.ai;

import com.example.stockservice.enums.FlashSaleStatus;
import com.example.stockservice.model.FlashSaleProduct;
import com.example.stockservice.model.FlashSaleSession;
import com.example.stockservice.repository.FlashSaleSessionRepository;
import com.example.stockservice.repository.FlashSaleProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Description;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Flash Sale Tools for AI Function Calling - SIMPLIFIED VERSION
 * Cho phép AI biết về các chương trình Flash Sale đang diễn ra
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FlashSaleTools {

    private final FlashSaleSessionRepository flashSaleSessionRepository;
    private final FlashSaleProductRepository flashSaleProductRepository;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // ============ Request/Response Records ============

    public record GetCurrentFlashSalesRequest() {
    }

    public record GetCurrentFlashSalesResponse(List<FlashSaleSessionInfo> sessions, int total, String message) {
    }

    public record GetFlashSaleProductsRequest(String sessionId) {
    }

    public record GetFlashSaleProductsResponse(List<FlashSaleProductInfo> products, String message) {
    }

    public record CheckProductInFlashSaleRequest(String productId) {
    }

    public record CheckProductInFlashSaleResponse(boolean inFlashSale, FlashSaleSessionInfo session, String message) {
    }

    public record GetUpcomingFlashSalesRequest() {
    }

    public record GetUpcomingFlashSalesResponse(List<FlashSaleSessionInfo> sessions, int total, String message) {
    }

    public record FlashSaleSessionInfo(
            String sessionId,
            String name,
            String startTime,
            String endTime,
            int productCount,
            String status,
            double maxDiscountPercent) {
    }

    public record FlashSaleProductInfo(
            String productId,
            String productName,
            String originalPrice,
            String salePrice,
            String discountPercent,
            int stock) {
    }

    // ============ Tool Functions ============

    /**
     * Lấy tất cả Flash Sales đang hoạt động
     */
    @Bean
    @Description("Get current active flash sales. Use when user asks about flash sales, sales today, current promotions.")
    public Function<GetCurrentFlashSalesRequest, GetCurrentFlashSalesResponse> getCurrentFlashSales() {
        return request -> {
            log.info("=== Tool called: getCurrentFlashSales() ===");

            try {
                LocalDateTime now = LocalDateTime.now();

                List<FlashSaleSession> activeSessions = flashSaleSessionRepository
                        .findByStatus(FlashSaleStatus.ACTIVE)
                        .stream()
                        .filter(session -> session.getStartTime().isBefore(now) && session.getEndTime().isAfter(now))
                        .toList();

                if (activeSessions.isEmpty()) {
                    return new GetCurrentFlashSalesResponse(List.of(), 0,
                            "There are currently no Flash Sales happening.");
                }

                List<FlashSaleSessionInfo> sessionInfos = activeSessions.stream()
                        .map(this::toSessionInfo)
                        .collect(Collectors.toList());

                StringBuilder message = new StringBuilder();
                message.append("**Flash Sale is happening now.:**\n\n");
                for (FlashSaleSessionInfo info : sessionInfos) {
                    message.append("• **").append(info.name()).append("**\n");
                    message.append("  - Time: ").append(info.startTime()).append(" - ").append(info.endTime())
                            .append("\n");
                    message.append("  - Number of products: ").append(info.productCount()).append("\n\n");
                }

                return new GetCurrentFlashSalesResponse(sessionInfos, sessionInfos.size(), message.toString());

            } catch (Exception e) {
                log.error("Error getting flash sales: ", e);
                return new GetCurrentFlashSalesResponse(List.of(), 0, "Unable to retrieve Flash Sale information.");
            }
        };
    }

    /**
     * Lấy danh sách sản phẩm trong một Flash Sale session
     */
    @Bean
    @Description("Get products in a specific flash sale session. Use when user wants to see products in a flash sale.")
    public Function<GetFlashSaleProductsRequest, GetFlashSaleProductsResponse> getFlashSaleProducts() {
        return request -> {
            log.info("=== Tool called: getFlashSaleProducts(sessionId={}) ===", request.sessionId());

            try {
                List<FlashSaleProduct> products = flashSaleProductRepository.findBySessionId(request.sessionId());

                if (products.isEmpty()) {
                    return new GetFlashSaleProductsResponse(List.of(), "Không có sản phẩm trong phiên này.");
                }

                List<FlashSaleProductInfo> infos = products.stream()
                        .map(this::toProductInfo)
                        .collect(Collectors.toList());

                return new GetFlashSaleProductsResponse(infos, "Đã tìm thấy " + infos.size() + " sản phẩm.");

            } catch (Exception e) {
                log.error("Error: ", e);
                return new GetFlashSaleProductsResponse(List.of(), "Lỗi khi lấy sản phẩm.");
            }
        };
    }

    /**
     * Kiểm tra một sản phẩm có đang trong Flash Sale không
     */
    @Bean
    @Description("Check if a specific product is in any active flash sale. Use when user asks about a product's flash sale status.")
    public Function<CheckProductInFlashSaleRequest, CheckProductInFlashSaleResponse> checkProductInFlashSale() {
        return request -> {
            log.info("=== Tool called: checkProductInFlashSale(productId={}) ===", request.productId());

            try {
                LocalDateTime now = LocalDateTime.now();
                List<FlashSaleProduct> products = flashSaleProductRepository.findByProductId(request.productId());

                for (FlashSaleProduct fsp : products) {
                    FlashSaleSession session = flashSaleSessionRepository.findById(fsp.getSessionId()).orElse(null);
                    if (session != null && session.getStatus() == FlashSaleStatus.ACTIVE
                            && session.getStartTime().isBefore(now) && session.getEndTime().isAfter(now)) {

                        return new CheckProductInFlashSaleResponse(true, toSessionInfo(session),
                                "Sản phẩm đang trong Flash Sale: " + session.getName());
                    }
                }

                return new CheckProductInFlashSaleResponse(false, null, "Sản phẩm không có trong Flash Sale.");

            } catch (Exception e) {
                log.error("Error: ", e);
                return new CheckProductInFlashSaleResponse(false, null, "Lỗi khi kiểm tra.");
            }
        };
    }

    /**
     * Lấy danh sách Flash Sales sắp diễn ra
     */
    @Bean
    @Description("Get upcoming flash sales. Use when user asks about future or scheduled flash sales.")
    public Function<GetUpcomingFlashSalesRequest, GetUpcomingFlashSalesResponse> getUpcomingFlashSales() {
        return request -> {
            log.info("=== Tool called: getUpcomingFlashSales() ===");

            try {
                LocalDateTime now = LocalDateTime.now();
                List<FlashSaleSession> upcoming = flashSaleSessionRepository
                        .findByStatus(FlashSaleStatus.ACTIVE)
                        .stream()
                        .filter(s -> s.getStartTime().isAfter(now))
                        .limit(5)
                        .toList();

                if (upcoming.isEmpty()) {
                    return new GetUpcomingFlashSalesResponse(List.of(), 0, "Chưa có Flash Sale sắp diễn ra.");
                }

                List<FlashSaleSessionInfo> infos = upcoming.stream().map(this::toSessionInfo)
                        .collect(Collectors.toList());
                return new GetUpcomingFlashSalesResponse(infos, infos.size(),
                        "Có " + infos.size() + " Flash Sale sắp diễn ra.");

            } catch (Exception e) {
                log.error("Error: ", e);
                return new GetUpcomingFlashSalesResponse(List.of(), 0, "Lỗi.");
            }
        };
    }

    // ============ Helper Methods ============

    private FlashSaleSessionInfo toSessionInfo(FlashSaleSession session) {
        int productCount = flashSaleProductRepository.countBySessionId(session.getId());

        return new FlashSaleSessionInfo(
                session.getId(),
                session.getName(),
                session.getStartTime().format(DATE_FORMAT),
                session.getEndTime().format(DATE_FORMAT),
                productCount,
                session.getStatus().name(),
                0 // maxDiscount - simplified for now
        );
    }

    private FlashSaleProductInfo toProductInfo(FlashSaleProduct fsp) {
        double discountPercent = 0;
        if (fsp.getOriginalPrice() > 0) {
            discountPercent = ((fsp.getOriginalPrice() - fsp.getSalePrice()) / fsp.getOriginalPrice()) * 100;
        }

        return new FlashSaleProductInfo(
                fsp.getProductId(),
                "Product " + fsp.getProductId(),
                formatPrice(fsp.getOriginalPrice()),
                formatPrice(fsp.getSalePrice()),
                String.format("%.0f%%", discountPercent),
                fsp.getFlashSaleStock());
    }

    private String formatPrice(Double price) {
        if (price == null || price == 0)
            return "0₫";
        return String.format("%,.0f₫", price);
    }
}
