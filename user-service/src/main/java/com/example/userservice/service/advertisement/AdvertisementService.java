package com.example.userservice.service.advertisement;

import com.example.userservice.enums.AdvertisementStatus;
import com.example.userservice.exception.NotFoundException;
import com.example.userservice.model.Advertisement;
import com.example.userservice.repository.AdvertisementRepository;
import com.example.userservice.request.AdvertisementRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdvertisementService {

    private final AdvertisementRepository advertisementRepository;

    @Transactional
    public Advertisement createAdvertisement(AdvertisementRequest request) {
        Advertisement ad = Advertisement.builder()
                .shopId(request.getShopId())
                .title(request.getTitle())
                .description(request.getDescription())
                .adType(request.getAdType())
                .imageUrl(request.getImageUrl())
                .targetUrl(request.getTargetUrl())
                .durationDays(request.getDurationDays())
                .status(AdvertisementStatus.PENDING)
                .build();
        return advertisementRepository.save(ad);
    }

    @Transactional
    public Advertisement createSystemAdvertisement(AdvertisementRequest request) {
        Advertisement ad = Advertisement.builder()
                .shopId("ADMIN") // Force ADMIN shopId
                .title(request.getTitle())
                .description(request.getDescription())
                .adType(request.getAdType())
                .imageUrl(request.getImageUrl())
                .targetUrl(request.getTargetUrl())
                .durationDays(request.getDurationDays())
                .status(AdvertisementStatus.APPROVED) // Auto-approve
                .placement(request.getPlacement() != null ? request.getPlacement() : "POPUP") // Default to POPUP if
                                                                                              // missing
                .startDate(LocalDateTime.now())
                .endDate(request.getDurationDays() != null ? LocalDateTime.now().plusDays(request.getDurationDays())
                        : null)
                .build();
        return advertisementRepository.save(ad);
    }

    @Transactional
    public Advertisement approveAdvertisement(String id, String placement) {
        Advertisement ad = advertisementRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Advertisement not found"));

        ad.setStatus(AdvertisementStatus.APPROVED);
        ad.setPlacement(placement);
        ad.setStartDate(LocalDateTime.now());
        if (ad.getDurationDays() != null) {
            ad.setEndDate(LocalDateTime.now().plusDays(ad.getDurationDays()));
        }

        return advertisementRepository.save(ad);
    }

    @Transactional
    public Advertisement rejectAdvertisement(String id, String reason) {
        Advertisement ad = advertisementRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Advertisement not found"));

        ad.setStatus(AdvertisementStatus.REJECTED);
        ad.setRejectionReason(reason);

        return advertisementRepository.save(ad);
    }

    public void deleteAdvertisement(String id) {
        Advertisement ad = advertisementRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Advertisement not found"));

        if (ad.getStatus() == AdvertisementStatus.APPROVED) {
            // Admin can always delete, but requirement says "ShopOwner cannot delete if
            // approved".
            // Since this is a service method, usually called by Controller.
            // We'll enforce this check in controller or separate method if caller is Shop.
            // But Admin can delete.
        }
        advertisementRepository.delete(ad);
    }

    public List<Advertisement> getAdsByShop(String shopId) {
        return advertisementRepository.findByShopId(shopId);
    }

    public List<Advertisement> getAllAds() {
        return advertisementRepository.findAll();
    }

    public List<Advertisement> getActiveAds(String placement) {
        List<Advertisement> approvedAds;
        if (placement == null || placement.isEmpty() || "ALL".equalsIgnoreCase(placement)
                || "BANNER".equalsIgnoreCase(placement)) {
            // If placement is generic or ALL, fetch ALL approved ads to randomize
            approvedAds = advertisementRepository.findByStatus(AdvertisementStatus.APPROVED);
        } else {
            approvedAds = advertisementRepository.findByPlacementAndStatus(placement, AdvertisementStatus.APPROVED);
        }
        LocalDateTime now = LocalDateTime.now();
        return approvedAds.stream()
                .filter(ad -> ad.getEndDate() == null || ad.getEndDate().isAfter(now))
                .collect(Collectors.toList());
    }
}
