package com.example.userservice.controller;

import com.example.userservice.model.Advertisement;
import com.example.userservice.request.AdvertisementRequest;
import com.example.userservice.service.advertisement.AdvertisementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v1/user/ads")
@RequiredArgsConstructor
public class AdvertisementController {

    private final AdvertisementService advertisementService;

    @PostMapping("/request")
    public ResponseEntity<Advertisement> createRequest(@RequestBody AdvertisementRequest request) {
        return ResponseEntity.ok(advertisementService.createAdvertisement(request));
    }

    @PostMapping("/system")
    public ResponseEntity<Advertisement> createSystemAd(@RequestBody AdvertisementRequest request) {
        return ResponseEntity.ok(advertisementService.createSystemAdvertisement(request));
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<Advertisement> approveAd(@PathVariable String id, @RequestParam String placement) {
        return ResponseEntity.ok(advertisementService.approveAdvertisement(id, placement));
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<Advertisement> rejectAd(@PathVariable String id, @RequestParam String reason) {
        return ResponseEntity.ok(advertisementService.rejectAdvertisement(id, reason));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Advertisement> updateAd(@PathVariable String id, @RequestBody AdvertisementRequest request) {
        return ResponseEntity.ok(advertisementService.updateAdvertisement(id, request));
    }

    @GetMapping("/shop/{shopId}")
    public ResponseEntity<List<Advertisement>> getShopAds(@PathVariable String shopId) {
        return ResponseEntity.ok(advertisementService.getAdsByShop(shopId));
    }

    @GetMapping("/all")
    public ResponseEntity<List<Advertisement>> getAllAds() {
        return ResponseEntity.ok(advertisementService.getAllAds());
    }

    @GetMapping("/active")
    public ResponseEntity<List<Advertisement>> getActiveAds(@RequestParam String placement) {
        return ResponseEntity.ok(advertisementService.getActiveAds(placement));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAd(@PathVariable String id) {
        // In real system, check permission. Here simplified.
        // Also check if approved/active logic.
        advertisementService.deleteAdvertisement(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/click")
    public ResponseEntity<Void> incrementClick(@PathVariable String id) {
        advertisementService.incrementClick(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<Void> incrementView(@PathVariable String id) {
        advertisementService.incrementView(id);
        return ResponseEntity.ok().build();
    }
}
