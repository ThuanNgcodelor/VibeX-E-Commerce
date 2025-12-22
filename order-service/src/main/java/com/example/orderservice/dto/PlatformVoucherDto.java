package com.example.orderservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO for Platform Voucher response to frontend
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PlatformVoucherDto {

    private String id;

    private String code;

    // Note: Backend uses "title", but this maps to "name" in frontend
    private String title;

    private String description;

    // String format: "PERCENTAGE" or "FIXED"
    private String discountType;

    private BigDecimal discountValue;

    private BigDecimal maxDiscountAmount;

    private BigDecimal minOrderValue;

    private Integer totalQuantity;

    private Integer usedQuantity;

    private LocalDateTime startAt;

    private LocalDateTime endAt;

    // String format: "ACTIVE", "INACTIVE", "EXPIRED", "SCHEDULED", "PAUSED"
    private String status;
}
