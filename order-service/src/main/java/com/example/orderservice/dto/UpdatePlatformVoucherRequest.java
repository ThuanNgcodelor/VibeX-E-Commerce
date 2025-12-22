package com.example.orderservice.dto;

import com.example.orderservice.enums.DiscountType;
import com.example.orderservice.enums.VoucherStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Request DTO for updating platform voucher
 * All fields except id are optional (partial update)
 */
@Data
public class UpdatePlatformVoucherRequest {

    @NotBlank(message = "Voucher ID is required")
    private String id;

    private String title;

    private String description;

    private DiscountType discountType;

    @Min(value = 0, message = "Discount value must be positive")
    private BigDecimal discountValue;

    @Min(value = 0, message = "Max discount amount must be positive")
    private BigDecimal maxDiscountAmount;

    @Min(value = 0, message = "Min order value must be positive")
    private BigDecimal minOrderValue;

    @Min(value = 1, message = "Total quantity must be at least 1")
    private Integer totalQuantity;

    private LocalDateTime startAt;

    private LocalDateTime endAt;

    private VoucherStatus status;
}
