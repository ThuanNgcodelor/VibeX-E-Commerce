package com.example.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserMissionDto {
    private String id; // UserMission ID
    private String missionId;
    private String title;
    private String description;
    private Long rewardAmount;
    private String actionCode;
    private Integer targetCount;
    private Integer progress;
    private Boolean completed;
    private Boolean claimed;
}
