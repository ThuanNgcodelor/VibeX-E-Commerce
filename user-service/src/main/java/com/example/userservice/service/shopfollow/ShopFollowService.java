package com.example.userservice.service.shopfollow;

import com.example.userservice.model.ShopFollow;
import com.example.userservice.repository.ShopFollowRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ShopFollowService {
    private final ShopFollowRepository shopFollowRepository;

    @Transactional
    public void followShop(String followerId, String shopId) {
        if (!shopFollowRepository.existsByFollowerIdAndShopId(followerId, shopId)) {
            ShopFollow follow = ShopFollow.builder()
                    .followerId(followerId)
                    .shopId(shopId)
                    .build();
            shopFollowRepository.save(follow);
        }
    }

    @Transactional
    public void unfollowShop(String followerId, String shopId) {
        shopFollowRepository.deleteByFollowerIdAndShopId(followerId, shopId);
    }

    public long getFollowerCount(String shopId) {
        return shopFollowRepository.countByShopId(shopId);
    }

    public boolean isFollowing(String followerId, String shopId) {
        return shopFollowRepository.existsByFollowerIdAndShopId(followerId, shopId);
    }
}
