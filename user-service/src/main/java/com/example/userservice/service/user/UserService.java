package com.example.userservice.service.user;

import java.util.List;

import org.springframework.web.multipart.MultipartFile;

import com.example.userservice.dto.CartDto;
import com.example.userservice.dto.UserInformationDto;
import com.example.userservice.model.User;
import com.example.userservice.model.UserDetails;
import com.example.userservice.request.RegisterRequest;
import com.example.userservice.request.UserUpdateRequest;

import jakarta.servlet.http.HttpServletRequest;

public interface UserService {
    User SaveUser(RegisterRequest registerRequest);

    org.springframework.data.domain.Page<User> getAllUsers(String search, String role, String status,
            org.springframework.data.domain.Pageable pageable);

    User getUserById(String id);

    User getUserByEmail(String email);

    User getUserByUsername(String username);

    User updateUserById(UserUpdateRequest request, MultipartFile file);

    void deleteUserById(String id);

    /**
     * Toggle active status of user account
     * ACTIVE -> INACTIVE (Lock account)
     * INACTIVE -> ACTIVE (Unlock account)
     */
    User toggleActiveStatus(String id);

    User findUserById(String id);

    User findUserByUsername(String username);

    User findUserByEmail(String email);

    UserDetails updateUserDetails(UserDetails toUpdate, UserDetails request, MultipartFile file);

    CartDto getCart(HttpServletRequest request);

    void updatePasswordByEmail(String email, String rawPassword);

    List<com.example.userservice.model.RoleRequest> getUserRoleRequests(String userId);

    UserInformationDto convertUserToUserInformationDto(User user);

    com.example.userservice.dto.UserAdminDto toUserAdminDto(User user);

    Long countActiveUsers();

    /**
     * Get all active user IDs
     * Used by notification-service for admin broadcast notifications
     */
    List<String> getAllActiveUserIds();

    List<com.example.userservice.dto.UserLocationStatDto> getUserLocationStats();
}
