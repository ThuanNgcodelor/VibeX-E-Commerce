package com.example.orderservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import org.springframework.data.domain.Persistable;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

@MappedSuperclass
@Getter
public abstract class BaseEntity implements Serializable, Persistable<String> {
    
    @Id
    @Setter  // Allow manual setting if needed
    private String id;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    /**
     * Auto-generate UUID before persist if not already set
     * This enables Hibernate batch insert while maintaining UUID functionality
     */
    @PrePersist
    protected void generateIdIfNeeded() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
    }
    
    @jakarta.persistence.Transient
    private boolean isNew = true;

    @Override
    public boolean isNew() {
        return isNew;
    }

    @jakarta.persistence.PostLoad
    @jakarta.persistence.PostPersist
    void markNotNew() {
        this.isNew = false;
    }
}