package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Kafka message for async order status update
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStatusOrderRequest {
    private String orderId;
    private String shopOwnerId;
    private String newStatus;
    private LocalDateTime timestamp;
    private String token;
}
