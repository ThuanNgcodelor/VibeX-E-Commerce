package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserOrderStatsDto {
    private String userId;
    private long totalOrders;
    private long successfulOrders;
    private long cancelledOrders;
    private long deliveringOrders;
}
