package com.example.userservice.controller;

import com.example.userservice.dto.BannerDto;
import com.example.userservice.enums.BannerPosition;
import com.example.userservice.request.CreateBannerRequest;
import com.example.userservice.request.UpdateBannerRequest;
import com.example.userservice.service.BannerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
// import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/v1/user/banner")
@RequiredArgsConstructor
public class BannerController {

    private final BannerService bannerService;

    /**
     * GET /v1/banners/active
     * Lấy tất cả banners đang active, grouped by position
     * Response: { "LEFT_MAIN": [...], "RIGHT_TOP": [...], "RIGHT_BOTTOM": [...] }
     */
    @GetMapping("/active")
    public ResponseEntity<Map<String, List<BannerDto>>> getActiveBanners() {
        return ResponseEntity.ok(bannerService.getActiveBanners());
    }

    /**
     * GET /v1/banners/active/{position}
     * Lấy banners active theo position cụ thể
     */
    @GetMapping("/active/{position}")
    public ResponseEntity<List<BannerDto>> getActiveBannersByPosition(
            @PathVariable BannerPosition position) {
        return ResponseEntity.ok(bannerService.getActiveBannersByPosition(position));
    }

    /**
     * POST /v1/banners/{id}/click
     * Track click event
     */
    @PostMapping("/{id}/click")
    public ResponseEntity<Void> trackClick(@PathVariable String id) {
        bannerService.trackClick(id);
        return ResponseEntity.ok().build();
    }

    /**
     * POST /v1/banners/{id}/view
     * Track view event
     */
    @PostMapping("/{id}/view")
    public ResponseEntity<Void> trackView(@PathVariable String id) {
        bannerService.trackView(id);
        return ResponseEntity.ok().build();
    }

    // ============ ADMIN APIs ============

    /**
     * GET /v1/banners
     * Lấy tất cả banners (admin only)
     */
    @GetMapping("/getAllBanner")
    public ResponseEntity<List<BannerDto>> getAllBanners() {
        return ResponseEntity.ok(bannerService.getAllBanners());
    }

    /**
     * GET /v1/banners/{id}
     * Lấy banner theo ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<BannerDto> getBannerById(@PathVariable String id) {
        return ResponseEntity.ok(bannerService.getBannerById(id));
    }

    /**
     * POST /v1/banners
     * Tạo banner mới
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BannerDto> createBanner(
            @RequestPart("request") @Valid CreateBannerRequest request,
            @RequestPart("image") MultipartFile image) {
        return ResponseEntity.ok(bannerService.createBanner(request, image));
    }

    /**
     * PUT /v1/banners/{id}
     * Cập nhật banner
     */
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BannerDto> updateBanner(
            @PathVariable String id,
            @RequestPart("request") UpdateBannerRequest request,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        return ResponseEntity.ok(bannerService.updateBanner(id, request, image));
    }

    /**
     * DELETE /v1/banners/{id}
     * Xóa banner
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBanner(@PathVariable String id) {
        bannerService.deleteBanner(id);
        return ResponseEntity.ok().build();
    }

    /**
     * PATCH /v1/banners/{id}/toggle
     * Bật/tắt banner (manual toggle is_active)
     */
    @PatchMapping("/{id}/toggle")
    public ResponseEntity<Void> toggleActive(@PathVariable String id) {
        bannerService.toggleActive(id);
        return ResponseEntity.ok().build();
    }

    /**
     * PATCH /v1/banners/{id}/order
     * Cập nhật display_order
     */
    @PatchMapping("/{id}/order")
    public ResponseEntity<Void> updateDisplayOrder(
            @PathVariable String id,
            @RequestParam Integer order) {
        bannerService.updateDisplayOrder(id, order);
        return ResponseEntity.ok().build();
    }
}
