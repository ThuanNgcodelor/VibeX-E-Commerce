package com.example.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeductSubscriptionRequestDTO {
    private String shopOwnerId;
    private BigDecimal amount;
    private String planName;
    private String planId;
}
