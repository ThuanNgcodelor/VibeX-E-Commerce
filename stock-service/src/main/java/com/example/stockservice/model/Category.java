package com.example.stockservice.model;

import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import lombok.*;

import java.util.List;

@Entity(name = "category_products")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Category extends BaseEntity {
    private String name;
    private String description;

    // We don't cascade from Category to Product to avoid accidentally deleting
    // products
    // when a category is removed or modified. Products will simply reference a
    // category by FK.
    @OneToMany(mappedBy = "category")
    private List<Product> products;
    private String imageId;
}
