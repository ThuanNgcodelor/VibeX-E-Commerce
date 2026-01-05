package com.example.userservice.controller;

import com.example.userservice.dto.ShopOwnerDto;
import com.example.userservice.jwt.JwtUtil;
import com.example.userservice.model.ShopOwner;
import com.example.userservice.request.UpdateShopOwnerRequest;
import com.example.userservice.service.shopowner.ShopOwnerService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RequiredArgsConstructor
@RestController
@RequestMapping("/v1/user/shop-owners")
public class ShopOwnerController {
    private final ModelMapper modelMapper;
    private final ShopOwnerService shopOwnerService;
    private final JwtUtil jwtUtil;

    @GetMapping("/info")
    public ResponseEntity<ShopOwnerDto> getShopOwnerInfo(HttpServletRequest requestHttp) {
        try {
            String userId = jwtUtil.ExtractUserId(requestHttp);
            ShopOwner shopOwner = shopOwnerService.getShopOwnerByUserId(userId);
            return ResponseEntity.ok(modelMapper.map(shopOwner, ShopOwnerDto.class));
        } catch (Exception e) {
            System.err.println("Error in getShopOwnerInfo: " + e.getMessage());
            if (e.getMessage() != null && (e.getMessage().contains("missing") || e.getMessage().contains("invalid"))) {
                return ResponseEntity.status(401).build();
            }
            throw e; // Let other exceptions (like NotFound) bubble up
        }
    }

    @GetMapping("/{userId}")
    public ResponseEntity<ShopOwnerDto> getShopOwnerByUserId(@PathVariable String userId) {
        ShopOwner shopOwner = shopOwnerService.getShopOwnerByUserId(userId);
        return ResponseEntity.ok(modelMapper.map(shopOwner, ShopOwnerDto.class));
    }

    @PutMapping(value = "/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ShopOwnerDto> updateShopOwner(@Valid @RequestPart("request") UpdateShopOwnerRequest request,
            @RequestPart(value = "file", required = false) MultipartFile file,
            HttpServletRequest requestHttp) {
        String userId = jwtUtil.ExtractUserId(requestHttp);
        request.setUserId(userId);
        ShopOwner updated = shopOwnerService.updateShopOwner(request, file);
        return ResponseEntity.ok(modelMapper.map(updated, ShopOwnerDto.class));
    }

    @GetMapping("/admin/list")
    public ResponseEntity<java.util.List<com.example.userservice.dto.ShopOwnerStatsDto>> getAllShopOwnersAdmin() {
        return ResponseEntity.ok(shopOwnerService.getAllShopOwnersWithStats());
    }
}
