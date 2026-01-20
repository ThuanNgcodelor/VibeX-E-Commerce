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
    private final com.example.userservice.service.shopCoin.ShopCoinService shopCoinService;

    @Transactional
    public void followShop(String followerId, String shopId) {
        if (!shopFollowRepository.existsByFollowerIdAndShopId(followerId, shopId)) {
            ShopFollow follow = ShopFollow.builder()
                    .followerId(followerId)
                    .shopId(shopId)
                    .build();
            shopFollowRepository.save(follow);

            // Trigger Mission Action: FOLLOW_SHOP
            try {
                shopCoinService.performMissionAction(followerId, "FOLLOW_SHOP");
            } catch (Exception e) {
                // Log error but don't fail the follow action
                System.err.println("Failed to trigger FOLLOW_SHOP mission: " + e.getMessage());
            }
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

    /**
     * Get all follower IDs for a shop
     * Used by notification-service to send notifications to followers
     */
    public java.util.List<String> getFollowerIds(String shopId) {
        return shopFollowRepository.findFollowerIdsByShopId(shopId);
    }
}
