package com.example.userservice.service;

import com.example.userservice.model.ShopDecoration;
import com.example.userservice.repository.ShopDecorationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ShopDecorationService {
    private final ShopDecorationRepository shopDecorationRepository;

    public ShopDecoration getDecorationByShopId(String shopId) {
        return shopDecorationRepository.findByShopId(shopId)
                .orElse(null);
    }

    @Transactional
    public ShopDecoration saveDecoration(String shopId, String content) {
        ShopDecoration decoration = shopDecorationRepository.findByShopId(shopId)
                .orElse(new ShopDecoration());

        if (decoration.getShopId() == null) {
            decoration.setShopId(shopId);
        }

        decoration.setContent(content);
        return shopDecorationRepository.save(decoration);
    }
}
