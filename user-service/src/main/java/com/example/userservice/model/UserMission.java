package com.example.userservice.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity(name = "user_missions")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class UserMission extends BaseEntity {

    @Column(nullable = false)
    private String userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mission_id", nullable = false)
    private Mission mission;

    @Builder.Default
    @Column(nullable = false)
    private Integer progress = 0;

    @Builder.Default
    @Column(nullable = false)
    private Boolean completed = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean claimed = false;

    @Column(name = "last_updated_date")
    private LocalDate lastUpdatedDate;
}
