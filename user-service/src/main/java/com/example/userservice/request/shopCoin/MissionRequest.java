package com.example.userservice.request.shopCoin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class MissionRequest {
    private String title;
    private String description;
    private Long rewardAmount;
    private String actionCode;
    private Integer targetCount;
}
