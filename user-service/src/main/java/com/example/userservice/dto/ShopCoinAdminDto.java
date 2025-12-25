package com.example.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ShopCoinAdminDto {
    private String userId;
    private String username;
    private String email;
    private Long points;
    private LocalDate lastCheckInDate;
    private Integer consecutiveDays;
}
