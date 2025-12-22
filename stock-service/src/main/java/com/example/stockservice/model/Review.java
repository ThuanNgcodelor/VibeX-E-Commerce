package com.example.stockservice.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.List;

@Entity(name = "reviews")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Review {
    @Id
    @UuidGenerator
    private String id;

    private String userId;
    private String username; // Cache username for display
    private String userAvatar; // Optional: Cache avatar

    private String productId;

    private int rating; // 1-5

    @Lob
    @Column(columnDefinition = "TEXT")
    private String comment;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "review_images", joinColumns = @JoinColumn(name = "review_id"))
    @Column(name = "image_id")
    private List<String> imageIds;

    @Column(columnDefinition = "TEXT")
    private String reply;

    private LocalDateTime repliedAt;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}