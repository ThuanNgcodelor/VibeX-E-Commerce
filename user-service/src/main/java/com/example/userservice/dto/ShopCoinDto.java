package com.example.userservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ShopCoinDto {
    private String id;
    private String userId;
    private Long points;
    private LocalDate checkInDate;
    private Boolean isCheckedInToday;
    private Integer consecutiveDays;
    private LocalDate lastCheckInDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
