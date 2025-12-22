package com.example.orderservice.dto;

import com.example.orderservice.enums.DiscountType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Request DTO for creating platform voucher
 */
@Data
public class CreatePlatformVoucherRequest {

    @NotBlank(message = "Voucher code is required")
    private String code;

    @NotBlank(message = "Voucher title is required")
    private String title;

    private String description;

    @NotNull(message = "Discount type is required")
    private DiscountType discountType;

    @NotNull(message = "Discount value is required")
    @Min(value = 0, message = "Discount value must be positive")
    private BigDecimal discountValue;

    @Min(value = 0, message = "Max discount amount must be positive")
    private BigDecimal maxDiscountAmount;

    @Min(value = 0, message = "Min order value must be positive")
    private BigDecimal minOrderValue;

    @NotNull(message = "Total quantity is required")
    @Min(value = 1, message = "Total quantity must be at least 1")
    private Integer totalQuantity;

    @NotNull(message = "Start date is required")
    private LocalDateTime startAt;

    @NotNull(message = "End date is required")
    private LocalDateTime endAt;
}
