package com.example.orderservice.controller;

import com.example.orderservice.dto.CreatePlatformVoucherRequest;
import com.example.orderservice.dto.PlatformVoucherDto;
import com.example.orderservice.dto.UpdatePlatformVoucherRequest;
import com.example.orderservice.service.PlatformVoucherService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Platform Voucher Management (Admin only)
 * Follows same pattern as CategoryController
 */
@RestController
@RequestMapping("/v1/order/admin/platform-vouchers")
@RequiredArgsConstructor
public class PlatformVoucherController {

    private final PlatformVoucherService platformVoucherService;

    /**
     * Get all platform vouchers
     * GET /v1/order/admin/platform-vouchers/getAll
     */
    @GetMapping("/getAll")
    public ResponseEntity<List<PlatformVoucherDto>> getAll() {
        List<PlatformVoucherDto> vouchers = platformVoucherService.getAll();
        return ResponseEntity.ok(vouchers);
    }

    /**
     * Get platform voucher by ID
     * GET /v1/order/admin/platform-vouchers/getById/{id}
     */
    @GetMapping("/getById/{id}")
    public ResponseEntity<PlatformVoucherDto> getById(@PathVariable String id) {
        PlatformVoucherDto voucher = platformVoucherService.getById(id);
        return ResponseEntity.ok(voucher);
    }

    /**
     * Create new platform voucher
     * POST /v1/order/admin/platform-vouchers/create
     */
    @PostMapping("/create")
    public ResponseEntity<PlatformVoucherDto> create(
            @Valid @RequestBody CreatePlatformVoucherRequest request) {
        PlatformVoucherDto voucher = platformVoucherService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(voucher);
    }

    /**
     * Update existing platform voucher
     * PUT /v1/order/admin/platform-vouchers/update
     */
    @PutMapping("/update")
    public ResponseEntity<PlatformVoucherDto> update(
            @Valid @RequestBody UpdatePlatformVoucherRequest request) {
        PlatformVoucherDto voucher = platformVoucherService.update(request);
        return ResponseEntity.ok(voucher);
    }

    /**
     * Delete platform voucher
     * DELETE /v1/order/admin/platform-vouchers/delete/{id}
     */
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        platformVoucherService.delete(id);
        return ResponseEntity.status(HttpStatus.OK).build();
    }
}
