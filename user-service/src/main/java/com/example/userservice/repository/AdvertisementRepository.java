package com.example.userservice.repository;

import com.example.userservice.enums.AdvertisementStatus;
import com.example.userservice.model.Advertisement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdvertisementRepository extends JpaRepository<Advertisement, String> {
    List<Advertisement> findByShopId(String shopId);

    List<Advertisement> findByStatus(AdvertisementStatus status);

    List<Advertisement> findByPlacementAndStatus(String placement, AdvertisementStatus status);
}
