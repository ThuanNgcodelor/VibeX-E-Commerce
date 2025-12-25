package com.example.userservice.model;

import com.example.userservice.enums.AdvertisementStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "advertisements")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(callSuper = true)
public class Advertisement extends BaseEntity {

    @Column(nullable = false)
    private String shopId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String adType; // e.g., "BANNER", "POPUP"

    private String imageUrl; // For simple image ads

    private String targetUrl; // Link when clicked

    @Column(nullable = false)
    private Integer durationDays; // Requested duration

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AdvertisementStatus status;

    private LocalDateTime startDate;
    private LocalDateTime endDate;

    private String placement; // HEADER, SIDEBAR, FOOTER, POPUP

    private String rejectionReason;
}
