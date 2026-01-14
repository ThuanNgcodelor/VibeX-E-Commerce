package com.example.userservice.specification;

import com.example.userservice.enums.Active;
import com.example.userservice.enums.Role;
import com.example.userservice.model.User;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

public class UserSpecification {

    public static Specification<User> filterUsers(String search, String role, String status) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Search (Email, Username, FirstName, LastName)
            if (StringUtils.hasText(search)) {
                String searchLike = "%" + search.toLowerCase() + "%";
                Predicate emailPredicate = criteriaBuilder.like(criteriaBuilder.lower(root.get("email")), searchLike);
                Predicate usernamePredicate = criteriaBuilder.like(criteriaBuilder.lower(root.get("username")),
                        searchLike);

                // For nested properties like firstName/lastName in UserDetails, we need to join
                // or navigate
                // Assuming User -> UserDetails relationship is accessible via "userDetails"
                Predicate firstNamePredicate = criteriaBuilder
                        .like(criteriaBuilder.lower(root.get("userDetails").get("firstName")), searchLike);
                Predicate lastNamePredicate = criteriaBuilder
                        .like(criteriaBuilder.lower(root.get("userDetails").get("lastName")), searchLike);

                predicates.add(
                        criteriaBuilder.or(emailPredicate, usernamePredicate, firstNamePredicate, lastNamePredicate));
            }

            // Role Filter
            if (StringUtils.hasText(role) && !role.equalsIgnoreCase("all")) {
                try {
                    Role roleEnum = Role.valueOf(role.toUpperCase());
                    // Filter by primary role or check if roles collection contains it
                    // Simple approach: check primaryRole
                    Predicate primaryRolePredicate = criteriaBuilder.equal(root.get("primaryRole"), roleEnum);
                    // If you want to check the Set<Role> roles, it's more complex (requires join).
                    // For now, let's assume filtering by Primary Role is sufficient for the admin
                    // table main view
                    // OR if 'roles' is element collection:
                    Predicate rolesPredicate = criteriaBuilder.isMember(roleEnum, root.get("roles"));
                    predicates.add(criteriaBuilder.or(primaryRolePredicate, rolesPredicate));
                } catch (IllegalArgumentException e) {
                    // Invalid role enum, ignore
                }
            }

            // Status Filter
            if (StringUtils.hasText(status) && !status.equalsIgnoreCase("all")) {
                try {
                    Active activeEnum = Active.valueOf(status.toUpperCase());
                    predicates.add(criteriaBuilder.equal(root.get("active"), activeEnum));
                } catch (IllegalArgumentException e) {
                    // Invalid status enum, ignore
                }
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }
}
