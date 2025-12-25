package com.example.userservice.model;

import jakarta.persistence.*;
import lombok.*;

@Entity(name = "missions")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class Mission extends BaseEntity {

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Long rewardAmount;

    // e.g. "VIEW_PRODUCT", "REVIEW_ORDER", "DAILY_LOGIN"
    @Column(nullable = false, unique = true)
    private String actionCode;

    // How many times the action must be performed (default 1)
    @Builder.Default
    @Column(nullable = false)
    private Integer targetCount = 1;
}
