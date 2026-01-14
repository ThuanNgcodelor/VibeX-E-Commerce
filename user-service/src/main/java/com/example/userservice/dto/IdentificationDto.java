package com.example.userservice.dto;

import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class IdentificationDto {
    private String identificationNumber;
    private String fullName;
    private String imageFrontUrl;
    private String imageBackUrl;
    private String identificationType;
}
