package com.example.userservice.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Table;
import lombok.*;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "shop_follows")
@EntityListeners(AuditingEntityListener.class)
public class ShopFollow extends BaseEntity {
    private String followerId;
    private String shopId;
}
