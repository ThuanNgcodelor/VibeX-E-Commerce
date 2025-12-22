package com.example.orderservice.service;

import com.example.orderservice.dto.CreatePlatformVoucherRequest;
import com.example.orderservice.dto.PlatformVoucherDto;
import com.example.orderservice.dto.UpdatePlatformVoucherRequest;
import com.example.orderservice.enums.DiscountType;
import com.example.orderservice.enums.VoucherStatus;
import com.example.orderservice.model.PlatformVoucher;
import com.example.orderservice.repository.PlatformVoucherRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for managing Platform Vouchers (Admin only)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PlatformVoucherService {

    private final PlatformVoucherRepository platformVoucherRepository;
    private final ModelMapper modelMapper;

    /**
     * Get all platform vouchers
     */
    public List<PlatformVoucherDto> getAll() {
        return platformVoucherRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get platform voucher by ID
     */
    public PlatformVoucherDto getById(String id) {
        PlatformVoucher voucher = findVoucherById(id);
        return mapToDto(voucher);
    }

    /**
     * Create new platform voucher
     */
    @Transactional
    public PlatformVoucherDto create(CreatePlatformVoucherRequest request) {
        // Check duplicate code
        String code = request.getCode().toUpperCase();
        if (platformVoucherRepository.existsByCode(code)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Voucher code '" + code + "' already exists");
        }

        // Validate date range
        if (request.getStartAt().isAfter(request.getEndAt())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Start date must be before end date");
        }

        // Build voucher entity
        PlatformVoucher voucher = PlatformVoucher.builder()
                .code(code)
                .title(request.getTitle())
                .description(request.getDescription())
                .discountType(request.getDiscountType())
                .discountValue(request.getDiscountValue())
                .maxDiscountAmount(request.getMaxDiscountAmount())
                .minOrderValue(request.getMinOrderValue())
                .quantityTotal(request.getTotalQuantity())
                .quantityUsed(0) // Always start at 0
                .startAt(request.getStartAt())
                .endAt(request.getEndAt())
                .status(VoucherStatus.ACTIVE) // Default status
                .build();

        PlatformVoucher saved = platformVoucherRepository.save(voucher);
        log.info("Created platform voucher: {} - {}", saved.getId(), saved.getCode());

        return mapToDto(saved);
    }

    /**
     * Update existing platform voucher (partial update)
     */
    @Transactional
    public PlatformVoucherDto update(UpdatePlatformVoucherRequest request) {
        PlatformVoucher voucher = findVoucherById(request.getId());

        // Update fields if provided (partial update)
        if (request.getTitle() != null) {
            voucher.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            voucher.setDescription(request.getDescription());
        }
        if (request.getDiscountType() != null) {
            voucher.setDiscountType(request.getDiscountType());
        }
        if (request.getDiscountValue() != null) {
            voucher.setDiscountValue(request.getDiscountValue());
        }
        if (request.getMaxDiscountAmount() != null) {
            voucher.setMaxDiscountAmount(request.getMaxDiscountAmount());
        }
        if (request.getMinOrderValue() != null) {
            voucher.setMinOrderValue(request.getMinOrderValue());
        }
        if (request.getTotalQuantity() != null) {
            voucher.setQuantityTotal(request.getTotalQuantity());
        }
        if (request.getStartAt() != null) {
            voucher.setStartAt(request.getStartAt());
        }
        if (request.getEndAt() != null) {
            voucher.setEndAt(request.getEndAt());
        }
        if (request.getStatus() != null) {
            voucher.setStatus(request.getStatus());
        }

        // Validate date range if both provided
        if (voucher.getStartAt() != null && voucher.getEndAt() != null &&
                voucher.getStartAt().isAfter(voucher.getEndAt())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Start date must be before end date");
        }

        PlatformVoucher updated = platformVoucherRepository.save(voucher);
        log.info("Updated platform voucher: {} - {}", updated.getId(), updated.getCode());

        return mapToDto(updated);
    }

    /**
     * Delete platform voucher
     * Business rule: Cannot delete if already used
     */
    @Transactional
    public void delete(String id) {
        PlatformVoucher voucher = findVoucherById(id);

        // Check if voucher has been used
        if (voucher.getQuantityUsed() != null && voucher.getQuantityUsed() > 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot delete voucher that has been used " +
                            voucher.getQuantityUsed() + " time(s)");
        }

        platformVoucherRepository.deleteById(id);
        log.info("Deleted platform voucher: {} - {}", id, voucher.getCode());
    }

    /**
     * Find voucher by ID or throw 404
     */
    private PlatformVoucher findVoucherById(String id) {
        return platformVoucherRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Platform voucher not found with ID: " + id));
    }

    /**
     * Map entity to DTO
     */
    private PlatformVoucherDto mapToDto(PlatformVoucher voucher) {
        PlatformVoucherDto dto = modelMapper.map(voucher, PlatformVoucherDto.class);

        // Map enum to string for frontend
        dto.setDiscountType(voucher.getDiscountType() == DiscountType.PERCENT
                ? "PERCENTAGE"
                : "FIXED");
        dto.setStatus(voucher.getStatus().name());

        // Map quantity fields
        dto.setTotalQuantity(voucher.getQuantityTotal());
        dto.setUsedQuantity(voucher.getQuantityUsed());

        return dto;
    }
}
