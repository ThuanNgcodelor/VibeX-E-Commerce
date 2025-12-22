package com.example.userservice.controller;

import com.example.userservice.dto.FullShopRegistrationRequest;
import com.example.userservice.jwt.JwtUtil;
import com.example.userservice.model.RoleRequest;
import com.example.userservice.request.IdentificationRequest;
import com.example.userservice.request.RoleRequestRequest;
import com.example.userservice.request.RoleRequestResponse;
import com.example.userservice.request.ShopOwnerRegisterRequest;
import com.example.userservice.request.TaxInfoRequest;
import com.example.userservice.service.role.RoleRequestService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Base64;
import java.util.List;

@RestController
@RequestMapping("/v1/user/role-requests")
@RequiredArgsConstructor
public class RoleRequestController {

    @Autowired
    private final RoleRequestService roleRequestService;
    private final JwtUtil jwtUtil;
    private final ModelMapper modelMapper;

    @GetMapping("/{requestId}")
    ResponseEntity<RoleRequestResponse> getRequestById(@PathVariable String requestId) {
        return ResponseEntity
                .ok(modelMapper.map(roleRequestService.getRoleRequestById(requestId), RoleRequestResponse.class));
    }

    @PostMapping(value = "/createShopOwner", consumes = { "multipart/form-data" })
    ResponseEntity<?> createShopOwner(
            HttpServletRequest request,
            @RequestParam("roleRequest") String roleRequestJson,
            @RequestParam("shopDetails") String shopDetailsJson,
            @RequestParam("identification") String identificationJson,
            @RequestParam("taxInfo") String taxInfoJson,
            @RequestPart(value = "imageFront", required = false) MultipartFile imageFront,
            @RequestPart(value = "imageBack", required = false) MultipartFile imageBack) {

        try {
            String userId = jwtUtil.ExtractUserId(request);
            ObjectMapper objectMapper = new ObjectMapper();

            RoleRequestRequest roleRequestData = objectMapper.readValue(roleRequestJson, RoleRequestRequest.class);
            ShopOwnerRegisterRequest shopDetailsData = objectMapper.readValue(shopDetailsJson,
                    ShopOwnerRegisterRequest.class);
            IdentificationRequest identification = objectMapper.readValue(identificationJson,
                    IdentificationRequest.class);
            TaxInfoRequest taxInfo = objectMapper.readValue(taxInfoJson, TaxInfoRequest.class);

            // Convert images to Base64 if provided
            if (imageFront != null && !imageFront.isEmpty()) {
                String frontBase64 = "data:" + imageFront.getContentType() + ";base64," +
                        Base64.getEncoder().encodeToString(imageFront.getBytes());
                identification.setImageFrontUrl(frontBase64);
            }

            if (imageBack != null && !imageBack.isEmpty()) {
                String backBase64 = "data:" + imageBack.getContentType() + ";base64," +
                        Base64.getEncoder().encodeToString(imageBack.getBytes());
                identification.setImageBackUrl(backBase64);
            }

            FullShopRegistrationRequest fullRequest = new FullShopRegistrationRequest();
            fullRequest.setRoleRequest(roleRequestData);
            fullRequest.setShopDetails(shopDetailsData);
            fullRequest.setIdentification(identification);
            fullRequest.setTaxInfo(taxInfo);

            roleRequestService.createShopOwner(userId, fullRequest);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Error processing registration: " + e.getMessage());
        }
    }

    // @PostMapping
    // public ResponseEntity<RoleRequestResponse> createRoleRequest(
    // @Valid @RequestBody RoleRequestRequest request,
    // HttpServletRequest httpRequest) {
    //
    //
    // String userId = jwtUtil.ExtractUserId(httpRequest);
    //
    // if (request.getRole() == null || request.getRole().trim().isEmpty()) {
    // throw new IllegalArgumentException("Role cannot be null or empty");
    // }
    //
    // Role requestedRole;
    // try {
    // requestedRole = Role.valueOf(request.getRole().toUpperCase());
    // } catch (IllegalArgumentException e) {
    // throw new IllegalArgumentException("Invalid role: " + request.getRole());
    // }
    //
    // RoleRequest created = roleRequestService.createRoleRequest(
    // userId,
    // requestedRole,
    // request.getReason()
    // );
    //
    // RoleRequestResponse response = RoleRequestResponse.builder()
    // .id(created.getId())
    // .userId(created.getUser().getId())
    // .requestedRole(created.getRequestedRole().name())
    // .reason(created.getReason())
    // .status(created.getStatus().name())
    // .build();
    //
    // return ResponseEntity.ok(response);
    // }

    @GetMapping("/pending")
    public ResponseEntity<List<RoleRequestResponse>> getPendingRequests() {
        List<RoleRequestResponse> responses = roleRequestService.getPendingRequests().stream()
                .map(rr -> RoleRequestResponse.builder()
                        .id(rr.getId())
                        .userId(rr.getUser() != null ? rr.getUser().getId() : null)
                        .requestedRole(rr.getRequestedRole().name())
                        .reason(rr.getReason())
                        .status(rr.getStatus().name())
                        .creationTimestamp(rr.getCreationTimestamp())
                        .adminNote(rr.getAdminNote())
                        .username(rr.getUser() != null ? rr.getUser().getUsername() : null)
                        .build())
                .toList();
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/user")
    public ResponseEntity<List<RoleRequestResponse>> getUserRequests(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        List<RoleRequestResponse> responses = roleRequestService.getUserRequests(userId).stream()
                .map(rr -> RoleRequestResponse.builder()
                        .id(rr.getId())
                        .userId(rr.getUser() != null ? rr.getUser().getId() : null)
                        .requestedRole(rr.getRequestedRole().name())
                        .reason(rr.getReason())
                        .status(rr.getStatus().name())
                        .creationTimestamp(rr.getCreationTimestamp())
                        .adminNote(rr.getAdminNote())
                        .username(rr.getUser() != null ? rr.getUser().getUsername() : null)
                        .build())
                .toList();
        return ResponseEntity.ok(responses);
    }

    // {{baseURL}}/v1/user/role-requests/ee24db1d-ae50-4894-9a94-9648d2baf4e2/approve?adminNote=vcl
    // ee24db1d-ae50-4894-9a94-9648d2baf4e2 laf ID cua roleRequest
    // adminNote=vcl ???
    // nhớ kẹp token admin
    @PostMapping("/{requestId}/approve")
    public ResponseEntity<RoleRequestResponse> approveRequest(
            @PathVariable String requestId,
            HttpServletRequest request,
            @RequestParam(required = false) String adminNote) {

        String adminId = jwtUtil.ExtractUserId(request);
        RoleRequest roleRequest = roleRequestService.approveRequest(requestId, adminId, adminNote);

        RoleRequestResponse response = RoleRequestResponse.builder()
                .id(roleRequest.getId())
                .userId(roleRequest.getUser() != null ? roleRequest.getUser().getId() : null)
                .requestedRole(roleRequest.getRequestedRole().name())
                .reason(roleRequest.getReason())
                .status(roleRequest.getStatus().name())
                .creationTimestamp(roleRequest.getCreationTimestamp())
                .adminNote(roleRequest.getAdminNote())
                .username(roleRequest.getUser() != null ? roleRequest.getUser().getUsername() : null)
                .build();

        return ResponseEntity.ok(response);
    }

    // {{baseURL}}/v1/user/role-requests/ee24db1d-ae50-4894-9a94-9648d2baf4e2/reject?rejectionReason=vcl
    // ee24db1d-ae50-4894-9a94-9648d2baf4e2 laf ID cua roleRequest
    // adminNote=vcl ???
    // nhớ kẹp token admin
    @PostMapping("/{requestId}/reject")
    public ResponseEntity<RoleRequestResponse> rejectRequest(
            @PathVariable String requestId,
            HttpServletRequest request,
            @RequestParam String rejectionReason) {
        String adminId = jwtUtil.ExtractUserId(request);
        RoleRequest roleRequest = roleRequestService.rejectRequest(requestId, adminId, rejectionReason);

        RoleRequestResponse response = RoleRequestResponse.builder()
                .id(roleRequest.getId())
                .userId(roleRequest.getUser() != null ? roleRequest.getUser().getId() : null)
                .requestedRole(roleRequest.getRequestedRole().name())
                .reason(roleRequest.getReason())
                .status(roleRequest.getStatus().name())
                .creationTimestamp(roleRequest.getCreationTimestamp())
                .adminNote(roleRequest.getAdminNote())
                .username(roleRequest.getUser() != null ? roleRequest.getUser().getUsername() : null)
                .build();

        return ResponseEntity.ok(response);
    }
}