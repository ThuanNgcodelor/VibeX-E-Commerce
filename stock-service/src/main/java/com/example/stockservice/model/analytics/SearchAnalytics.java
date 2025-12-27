package com.example.stockservice.model.analytics;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Entity to store search keyword analytics
 * Tracks how often keywords are searched and clicked
 */
@Entity(name = "search_analytics")
@Table(name = "search_analytics", 
    indexes = {
        @Index(name = "idx_sa_date", columnList = "date"),
        @Index(name = "idx_sa_search_count", columnList = "searchCount")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_keyword_date", columnNames = {"keyword", "date"})
    }
)
@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchAnalytics {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;
    
    /**
     * Search keyword
     */
    @Column(length = 255, nullable = false)
    private String keyword;
    
    /**
     * Number of times this keyword was searched
     */
    @Builder.Default
    private Long searchCount = 0L;
    
    /**
     * Number of times users clicked on a product after searching this keyword
     */
    @Builder.Default
    private Long clickCount = 0L;
    
    /**
     * Date of the search (for daily aggregation)
     */
    @Column(nullable = false)
    private LocalDate date;
    
    /**
     * Record creation timestamp
     */
    @Column(updatable = false)
    private LocalDateTime createdAt;
    
    /**
     * Record update timestamp
     */
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
