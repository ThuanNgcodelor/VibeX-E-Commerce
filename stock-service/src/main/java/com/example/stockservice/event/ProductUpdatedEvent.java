package com.example.stockservice.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class ProductUpdatedEvent extends ApplicationEvent {
    private final String productId;

    public ProductUpdatedEvent(Object source, String productId) {
        super(source);
        this.productId = productId;
    }
}
