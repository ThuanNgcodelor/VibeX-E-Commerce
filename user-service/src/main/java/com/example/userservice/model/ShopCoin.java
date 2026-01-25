package com.example.userservice.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity(name = "shop_coins")
@AllArgsConstructor
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ShopCoin extends BaseEntity {
    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    @Builder.Default
    private Long points = 0L;

    @Column(name = "check_in_date")
    private LocalDate checkInDate;

    @Column(name = "is_checked_in_today")
    @Builder.Default
    private Boolean isCheckedInToday = false;

    @Column(name = "consecutive_days")
    @Builder.Default
    private Integer consecutiveDays = 0;

    @Column(name = "last_check_in_date")
    private LocalDate lastCheckInDate;

    @Column(name = "last_view_product_date")
    private LocalDate lastViewProductDate;

    @Column(name = "last_review_mission_date")
    private LocalDate lastReviewMissionDate;

    public void addPoints(Long pointsToAdd) {
        this.points += pointsToAdd;
    }

    public void deductPoints(Long pointsToDeduct) {
        if (this.points < pointsToDeduct) {
            throw new IllegalStateException("Insufficient points balance");
        }
        this.points -= pointsToDeduct;
    }

    public void recordCheckIn() {
        LocalDate today = LocalDate.now();
        if (this.lastCheckInDate != null && this.lastCheckInDate.equals(today)) {
            // Already checked in today
            return;
        }

        if (this.lastCheckInDate != null && this.lastCheckInDate.equals(today.minusDays(1))) {
            // Consecutive check-in
            this.consecutiveDays++;
            // Reset after 7 days
            if (this.consecutiveDays > 7) {
                this.consecutiveDays = 1;
            }
        } else {
            // Missed a day or first time
            this.consecutiveDays = 1;
        }

        this.lastCheckInDate = today;
        this.isCheckedInToday = true;
        this.checkInDate = today;
    }
}
