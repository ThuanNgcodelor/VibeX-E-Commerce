package com.example.stockservice.model;

import com.example.stockservice.enums.ProductStatus;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Entity(name = "products")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Product extends BaseEntity {
    private String name;
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String description;
    private double price;
    private double originalPrice;
    @Builder.Default
    private double discountPercent = 0;
    @Enumerated(EnumType.STRING)
    private ProductStatus status;
    private String imageId; // Main image

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "product_images", joinColumns = @JoinColumn(name = "product_id"))
    @Column(name = "image_id")
    private List<String> imageIds; // Multiple images/videos

    private String userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = true)
    private Category category;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Size> sizes;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String attributeJson;
}