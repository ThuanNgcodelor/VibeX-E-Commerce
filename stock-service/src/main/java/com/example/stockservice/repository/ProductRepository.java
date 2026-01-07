package com.example.stockservice.repository;

import com.example.stockservice.enums.ProductStatus;
import com.example.stockservice.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, String> {
    @Query("SELECT p FROM products p WHERE p.name LIKE CONCAT('%', :keyword, '%')")
    List<Product> searchProductByName(@Param("keyword") String keyword);

    Page<Product> findAllByStatus(ProductStatus status, Pageable pageable);

    List<Product> findByUserId(String userId);

    @Query("SELECT DISTINCT p FROM products p LEFT JOIN FETCH p.sizes where p.status = 'IN_STOCK'")
    List<Product> findAllWithSizes();

    long countByCategory_Id(String categoryId);

    @Query("SELECT COUNT(p) FROM products p WHERE p.userId = :userId")
    long countByUserId(@Param("userId") String userId);

    @Query("SELECT COUNT(p) FROM products p WHERE p.userId = :userId AND p.status = :status")
    long countByUserIdAndStatus(@Param("userId") String userId, @Param("status") ProductStatus status);

    List<Product> findByCategoryId(String categoryId);

    @Query("SELECT p.category.name, COUNT(p) FROM products p WHERE p.userId = :userId GROUP BY p.category.name")
    List<Object[]> countProductsByCategory(@Param("userId") String userId);

    // Batch API: Fetch multiple products in one query
    @Query("SELECT p FROM products p LEFT JOIN FETCH p.sizes WHERE p.id IN :ids")
    List<Product> findAllByIdIn(@Param("ids") List<String> ids);
}
