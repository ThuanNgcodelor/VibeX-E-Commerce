package com.example.stockservice.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import lombok.*;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

@Entity(name = "carts")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Cart extends BaseEntity {
    private String userId;
    private double totalAmount;

    @OneToMany(mappedBy = "cart", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    private Set<CartItem> items = new HashSet<>();

    public void updateTotalAmount() {
        if (items == null) {
            this.totalAmount = 0;
            return;
        }
        this.totalAmount = items.stream()
                .mapToDouble(CartItem::getTotalPrice)
                .sum();
    }

    public void removeItem(CartItem cartItem) {
        if (items == null)
            return;
        cartItem.setCart(null);
        items.remove(cartItem);
        updateTotalAmount();
    }
}
