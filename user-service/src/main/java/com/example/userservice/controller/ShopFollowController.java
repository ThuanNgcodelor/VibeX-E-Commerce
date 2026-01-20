package com.example.userservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.userservice.jwt.JwtUtil;
import com.example.userservice.service.shopfollow.ShopFollowService;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/user/follow")
@RequiredArgsConstructor
public class ShopFollowController {
    private final ShopFollowService shopFollowService;
    private final JwtUtil jwtUtil;

    @PostMapping("/{shopId}")
    public ResponseEntity<Void> followShop(@PathVariable String shopId, HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        shopFollowService.followShop(userId, shopId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{shopId}")
    public ResponseEntity<Void> unfollowShop(@PathVariable String shopId, HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        shopFollowService.unfollowShop(userId, shopId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{shopId}/count")
    public ResponseEntity<Long> getFollowerCount(@PathVariable String shopId) {
        return ResponseEntity.ok(shopFollowService.getFollowerCount(shopId));
    }

    @GetMapping("/{shopId}/status")
    public ResponseEntity<Boolean> isFollowing(@PathVariable String shopId, HttpServletRequest request) {
        // Allow unauthenticated check (returns false) or require auth?
        // Usually frontend checks status only if logged in.
        // Let's safe check for token presence or handle exception if ExtractUserId
        // fails?
        // Assuming ExtractUserId might throw exception if no token.
        // For simplicity, we assume this is called by logged in user.
        try {
            String userId = jwtUtil.ExtractUserId(request);
            if (userId == null)
                return ResponseEntity.ok(false);
            return ResponseEntity.ok(shopFollowService.isFollowing(userId, shopId));
        } catch (Exception e) {
            return ResponseEntity.ok(false);
        }
    }

    /**
     * Get all follower IDs for a shop
     * Called by notification-service to send notifications to followers
     */
    @GetMapping("/{shopId}/follower-ids")
    public ResponseEntity<java.util.List<String>> getFollowerIds(@PathVariable String shopId) {
        return ResponseEntity.ok(shopFollowService.getFollowerIds(shopId));
    }
}
