package com.example.userservice.controller.shopCoin;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.userservice.dto.ShopCoinDto;
import com.example.userservice.jwt.JwtUtil;
import com.example.userservice.request.shopCoin.ShopCoinAddPointsRequest;
import com.example.userservice.request.shopCoin.ShopCoinCheckInRequest;
import com.example.userservice.service.shopCoin.ShopCoinService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/v1/user/shop-coin")
@RequiredArgsConstructor
@Slf4j
public class ShopCoinController {

    private final ShopCoinService shopCoinService;
    private final JwtUtil jwtUtil;

    @GetMapping("/my-coins")
    public ResponseEntity<ShopCoinDto> getMyShopCoins(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        log.info("Getting ShopCoin for user: {}", userId);
        ShopCoinDto shopCoin = shopCoinService.getOrCreateShopCoin(userId);
        return ResponseEntity.ok(shopCoin);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ShopCoinDto> getUserShopCoins(@PathVariable String userId) {
        log.info("Getting ShopCoin for user: {}", userId);
        ShopCoinDto shopCoin = shopCoinService.getUserShopCoin(userId);
        return ResponseEntity.ok(shopCoin);
    }

    @PostMapping("/daily-check-in")
    public ResponseEntity<ShopCoinDto> dailyCheckIn(
            @Valid @RequestBody ShopCoinCheckInRequest request,
            HttpServletRequest httpRequest) {
        String userId = jwtUtil.ExtractUserId(httpRequest);
        log.info("User {} attempting daily check-in", userId);
        ShopCoinDto result = shopCoinService.dailyCheckIn(userId, request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/add-points")
    public ResponseEntity<ShopCoinDto> addPoints(
            @Valid @RequestBody ShopCoinAddPointsRequest request,
            HttpServletRequest httpRequest) {
        String userId = jwtUtil.ExtractUserId(httpRequest);
        log.info("Adding {} points to user {}", request.getPoints(), userId);
        ShopCoinDto result = shopCoinService.addPoints(userId, request);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/check-in-status")
    public ResponseEntity<Boolean> hasCheckedInToday(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        boolean hasCheckedIn = shopCoinService.hasCheckedInToday(userId);
        return ResponseEntity.ok(hasCheckedIn);
    }

    @GetMapping("/all")
    public ResponseEntity<org.springframework.data.domain.Page<com.example.userservice.dto.ShopCoinAdminDto>> getAllShopCoins(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        return ResponseEntity.ok(shopCoinService.getAllShopCoins(pageable));
    }

    @PostMapping("/mission/review")
    public ResponseEntity<Void> performReviewMission(
            @RequestBody com.example.userservice.request.shopCoin.ShopCoinAddPointsRequest request) {
        // Technically we just need userId, but reusing request or creating a simple one
        // is fine.
        // Let's assume we pass userId in a simple map or DTO.
        // Actually, stock-service passes ShopCoinAddPointsRequest.
        // But for this specific endpoint, we should probably take a simple DTO or just
        // userId if strict.
        // However, to keep it simple and consistent:
        // We can extract userId from the request if we change the signature to take a
        // specific DTO.
        // But wait, the service method takes `userId`.
        // Let's expect a JSON body with userId.
        return ResponseEntity.badRequest().build(); // Placeholder, replaced below
    }

    // Better implementation:
    @PostMapping("/mission/review-completion")
    public ResponseEntity<Void> completeReviewMission(@RequestParam String userId) {
        log.info("Completing Review Mission for user: {}", userId);
        shopCoinService.performReviewMission(userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/mission/view-product")
    public ResponseEntity<ShopCoinDto> performViewProductMission(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        return ResponseEntity.ok(shopCoinService.performViewProductMission(userId));
    }

    // --- Dynamic Mission System ---

    @PostMapping("/missions")
    public ResponseEntity<com.example.userservice.model.Mission> createMission(
            @RequestBody com.example.userservice.request.shopCoin.MissionRequest request) {
        return ResponseEntity.ok(shopCoinService.createMission(request));
    }

    @GetMapping("/missions")
    public ResponseEntity<java.util.List<com.example.userservice.dto.MissionDto>> getAllMissions() {
        return ResponseEntity.ok(shopCoinService.getAllMissions());
    }

    @GetMapping("/my-missions")
    public ResponseEntity<java.util.List<com.example.userservice.dto.UserMissionDto>> getMyMissions(
            HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        return ResponseEntity.ok(shopCoinService.getMissionsForUser(userId));
    }

    @PostMapping("/missions/action/{actionCode}")
    public ResponseEntity<com.example.userservice.dto.UserMissionDto> performMissionAction(
            @PathVariable String actionCode, HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        return ResponseEntity.ok(shopCoinService.performMissionAction(userId, actionCode));
    }

    @PostMapping("/missions/claim/{missionId}")
    public ResponseEntity<ShopCoinDto> claimMissionReward(
            @PathVariable String missionId, HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        return ResponseEntity.ok(shopCoinService.claimMissionReward(userId, missionId));
    }

    @PutMapping("/missions/{id}")
    public ResponseEntity<com.example.userservice.model.Mission> updateMission(
            @PathVariable String id,
            @RequestBody com.example.userservice.request.shopCoin.MissionRequest request) {
        com.example.userservice.model.Mission updatedMission = shopCoinService.updateMission(id, request);
        return ResponseEntity.ok(updatedMission);
    }

    @DeleteMapping("/missions/{id}")
    public ResponseEntity<Void> deleteMission(@PathVariable String id) {
        shopCoinService.deleteMission(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/game-reward")
    public ResponseEntity<ShopCoinDto> addGameReward(
            @RequestBody com.example.userservice.request.shopCoin.GameRewardRequest request,
            HttpServletRequest httpRequest) {
        String userId = jwtUtil.ExtractUserId(httpRequest);
        log.info("Adding game reward for user {}: score {}", userId, request.getScore());
        ShopCoinDto result = shopCoinService.addGamePoints(userId, request.getScore());
        return ResponseEntity.ok(result);
    }
}
