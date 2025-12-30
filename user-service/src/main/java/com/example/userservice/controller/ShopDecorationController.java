package com.example.userservice.controller;

import com.example.userservice.model.ShopDecoration;
import com.example.userservice.service.ShopDecorationService;
import com.example.userservice.jwt.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/user/shops")
@RequiredArgsConstructor
public class ShopDecorationController {
    private final ShopDecorationService shopDecorationService;
    private final JwtUtil jwtUtil;
    private final HttpServletRequest requestHttp;
    private final com.example.userservice.client.FileStorageClient fileStorageClient;

    // Public endpoint to get shop decoration
    @GetMapping("/{shopId}/decoration")
    public ResponseEntity<ShopDecoration> getShopDecoration(@PathVariable String shopId) {
        ShopDecoration decoration = shopDecorationService.getDecorationByShopId(shopId);
        if (decoration == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(decoration);
    }

    // Shop Owner endpoint to get their own decoration
    @GetMapping("/decoration/me")
    public ResponseEntity<ShopDecoration> getMyDecoration() {
        String shopId = jwtUtil.ExtractUserId(requestHttp);
        ShopDecoration decoration = shopDecorationService.getDecorationByShopId(shopId);
        if (decoration == null) {
            // Return empty object or default
            return ResponseEntity.ok(new ShopDecoration());
        }
        return ResponseEntity.ok(decoration);
    }

    // Shop Owner endpoint to save decoration
    @PutMapping("/decoration/me")
    public ResponseEntity<ShopDecoration> saveMyDecoration(@RequestBody String content) {
        String shopId = jwtUtil.ExtractUserId(requestHttp);
        ShopDecoration saved = shopDecorationService.saveDecoration(shopId, content);
        return ResponseEntity.ok(saved);
    }

    @PostMapping(value = "/decoration/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> uploadDecorationImage(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File is empty");
        }
        try {
            // Upload to file-storage service
            String imageId = fileStorageClient.uploadImageToFIleSystem(file).getBody();

            // Construct full URL
            String imageUrl = "http://localhost:8080/v1/file-storage/get/" + imageId;

            return ResponseEntity.ok(imageUrl);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Upload failed: " + e.getMessage());
        }
    }
}
