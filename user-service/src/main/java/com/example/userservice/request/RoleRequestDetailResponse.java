package com.example.userservice.request;

import com.example.userservice.dto.IdentificationDto;
import com.example.userservice.dto.ShopOwnerDto;
import com.example.userservice.dto.TaxInfoDto;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class RoleRequestDetailResponse {
    // Basic RoleRequest Info
    private String id;
    private String userId;
    private String requestedRole;
    private String reason;
    private String status;
    private java.time.LocalDateTime creationTimestamp;
    private String adminNote;
    private String username;

    // Detailed Info
    private ShopOwnerDto shopDetails;
    private IdentificationDto identification;
    private TaxInfoDto taxInfo;
}
