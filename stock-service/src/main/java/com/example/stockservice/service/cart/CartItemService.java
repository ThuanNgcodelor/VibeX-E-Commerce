package com.example.stockservice.service.cart;

import com.example.stockservice.model.CartItem;
import com.example.stockservice.request.cart.AddCartItemRequest;
import com.example.stockservice.request.cart.AddLiveCartItemRequest;
import com.example.stockservice.request.cart.UpdateCartItemRequest;

public interface CartItemService {
    CartItem updateCartItem(UpdateCartItemRequest request);
    void removeCartItem(String userId, String productId, String sizeId);
    void removeCartItemByCartItemId(String userId, String cartItemId);
    CartItem addCartItem(AddCartItemRequest request, String userId);
    CartItem addLiveCartItem(AddLiveCartItemRequest request, String userId);
}
