package com.example.userservice.service.role;

import com.example.userservice.dto.FullShopRegistrationRequest;
import com.example.userservice.enums.*;
import com.example.userservice.exception.NotFoundException;
import com.example.userservice.model.*;
import com.example.userservice.repository.IdentificationRepository;
import com.example.userservice.repository.RoleRequestRepository;
import com.example.userservice.repository.ShopOwnerRepository;
import com.example.userservice.repository.TaxInfoRepository;
import com.example.userservice.repository.UserRepository;
import com.example.userservice.request.IdentificationRequest;
import com.example.userservice.request.RoleRequestRequest;
import com.example.userservice.request.ShopOwnerRegisterRequest;
import com.example.userservice.request.TaxInfoRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoleRequestService {
    private final RoleRequestRepository roleRequestRepository;
    private final UserRepository userRepository;
    private final ShopOwnerRepository shopOwnerRepository;
    private final TaxInfoRepository taxInfoRepository;
    private final IdentificationRepository identificationRepository;

    public RoleRequest getRoleRequestById(String requestId) {
        return roleRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("404"));
    }

    private void createRoleRequestRecord(User user, RoleRequestRequest roleRequestData) {
        // Kiểm tra spam request
        boolean existsPending = roleRequestRepository.existsByUserAndStatus(user, RequestStatus.PENDING);
        if (existsPending) {
            throw new RuntimeException("Your request has already been pending.");
        }

        // Chặn tạo request nếu role đã được duyệt hoặc user đã có role đó
        Role requestedRole = Role.valueOf(roleRequestData.getRole());
        boolean hasRoleAlready = user.getRoles() != null && user.getRoles().contains(requestedRole);
        boolean existsApproved = roleRequestRepository
                .findByUserIdAndRequestedRoleAndStatus(user.getId(), requestedRole, RequestStatus.APPROVED)
                .isPresent();
        if (hasRoleAlready || existsApproved) {
            throw new RuntimeException("You already have this role approved.");
        }

        RoleRequest newRequest = RoleRequest.builder()
                .user(user)
                .requestedRole(requestedRole)
                .reason(roleRequestData.getReason())
                .status(RequestStatus.PENDING)
                .build();

        roleRequestRepository.save(newRequest);
    }

    @Transactional
    public void createShopOwner(String userId, FullShopRegistrationRequest fullRequest) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Lưu thông tin shop
        createShopOwnerProfile(user, fullRequest.getShopDetails());

        // Lưu thông tin thuế
        if (fullRequest.getTaxInfo() != null) {
            createShopOwnerTaxInfo(user, fullRequest.getTaxInfo());
        }

        // Lưu thông tin định danh
        if (fullRequest.getIdentification() != null) {
            createShopOwnerIdentification(user, fullRequest.getIdentification());
        }

        // Tạo role request
        createRoleRequestRecord(user, fullRequest.getRoleRequest());
    }

    @Transactional
    public RoleRequest approveRequest(String requestId, String adminId, String adminNote) {
        RoleRequest request = roleRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (request.getStatus() != RequestStatus.PENDING) {
            throw new RuntimeException("Request is not pending");
        }

        String userId = request.getUser().getId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Role requestedRole = request.getRequestedRole();

        // Add role to user
        user.getRoles().add(requestedRole);
        userRepository.saveAndFlush(user);

        // Create ShopOwner profile if role is SHOP_OWNER
        // if (requestedRole == Role.SHOP_OWNER) {
        // createShopOwnerProfile(userId);
        // }

        request.setStatus(RequestStatus.APPROVED);
        request.setReviewedBy(adminId);
        request.setReviewedAt(LocalDateTime.now());
        request.setAdminNote(adminNote);

        return roleRequestRepository.save(request);
    }

    @Transactional
    public RoleRequest rejectRequest(String requestId, String adminId, String rejectionReason) {
        RoleRequest request = roleRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (request.getStatus() != RequestStatus.PENDING) {
            throw new RuntimeException("Request is not pending");
        }

        request.setStatus(RequestStatus.REJECTED);
        request.setReviewedBy(adminId);
        request.setReviewedAt(LocalDateTime.now());
        request.setRejectionReason(rejectionReason);

        return roleRequestRepository.save(request);
    }

    public List<RoleRequest> getPendingRequests() {
        return roleRequestRepository.findByStatusOrderByCreationTimestampDesc(RequestStatus.PENDING);
    }

    public List<RoleRequest> getUserRequests(String userId) {
        return roleRequestRepository.findByUserIdOrderByCreationTimestampDesc(userId);
    }

    private void createShopOwnerProfile(User user, ShopOwnerRegisterRequest request) {

        if (shopOwnerRepository.existsById(user.getId())) {
            return;
        }

        // Tạo chuỗi địa chỉ hiển thị
        String fullAddress = String.format("%s, %s, %s, %s",
                request.getStreetAddress(),
                request.getWardName(),
                request.getDistrictName(),
                request.getProvinceName());

        ShopOwner shopOwner = ShopOwner.builder()
                .user(user) // User đã map ID
                .shopName(request.getShopName()) // SỬA LỖI 1: Lấy từ request
                .ownerName(request.getOwnerName()) // SỬA LỖI 1: Lấy từ request
                .phone(request.getPhone()) // Đừng quên số điện thoại
                .address(fullAddress) // SỬA LỖI 3: Lưu địa chỉ full

                // Logic mặc định
                .verified(false) // SỬA LỖI 2: Mới tạo phải là false chờ duyệt
                .totalRatings(0)
                .followersCount(0)
                .followingCount(0)

                // Mapping địa chỉ GHN
                .provinceId(request.getProvinceId())
                .provinceName(request.getProvinceName())
                .districtId(request.getDistrictId())
                .districtName(request.getDistrictName())
                .wardCode(request.getWardCode())
                .wardName(request.getWardName())
                .streetAddress(request.getStreetAddress())

                // Tọa độ
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .build();

        shopOwnerRepository.save(shopOwner);
    }

    private void createShopOwnerTaxInfo(User user, TaxInfoRequest request) {
        // Kiểm tra đã tồn tại chưa
        if (taxInfoRepository.findByUserId(user.getId()).isPresent()) {
            return;
        }

        BusinessType businessTypeEnum;
        try {
            businessTypeEnum = BusinessType.valueOf(request.getBusinessType().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid business type: " + request.getBusinessType());
        }

        TaxInfo taxInfo = TaxInfo.builder()
                .userId(user.getId())
                .businessType(businessTypeEnum)
                .businessAddress(request.getBusinessAddress())
                .email(request.getEmail())
                .taxCode(request.getTaxCode())
                .build();

        taxInfoRepository.save(taxInfo);
    }

    private void createShopOwnerIdentification(User user, IdentificationRequest request) {
        // Kiểm tra đã tồn tại chưa
        if (identificationRepository.findByUserId(user.getId()).isPresent()) {
            return;
        }

        IdentificationType identificationTypeEnum;
        try {
            identificationTypeEnum = IdentificationType.valueOf(request.getIdentificationType().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid identification type: " + request.getIdentificationType());
        }

        Identification identification = Identification.builder()
                .userId(user.getId())
                .identificationType(identificationTypeEnum)
                .identificationNumber(request.getIdentificationNumber())
                .fullName(request.getFullName())
                .imageFrontUrl(request.getImageFrontUrl()) // Có thể null
                .imageBackUrl(request.getImageBackUrl()) // Có thể null
                .build();

        identificationRepository.save(identification);
    }
}
