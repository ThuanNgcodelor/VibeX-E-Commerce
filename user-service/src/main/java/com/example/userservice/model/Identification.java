package com.example.userservice.model;

import com.example.userservice.enums.IdentificationType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "identification")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Identification {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "identification_type", nullable = false)
    private IdentificationType identificationType;

    @Column(name = "identification_number", length = 20, nullable = false)
    private String identificationNumber;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "image_front_url", columnDefinition = "LONGTEXT")
    private String imageFrontUrl;

    @Column(name = "image_back_url", columnDefinition = "LONGTEXT")
    private String imageBackUrl;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
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
