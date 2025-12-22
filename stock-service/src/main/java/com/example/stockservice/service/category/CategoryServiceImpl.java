package com.example.stockservice.service.category;

import com.example.stockservice.client.FileStorageClient;
import com.example.stockservice.dto.CategoryDto;
import com.example.stockservice.model.Category;
import com.example.stockservice.repository.CategoryRepository;
import com.example.stockservice.repository.ProductRepository;
import com.example.stockservice.request.category.CategoryCreateRequest;
import com.example.stockservice.request.category.CategoryUpdateRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CategoryServiceImpl implements CategoryService {
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final FileStorageClient fileStorageClient;
    private final ModelMapper modelMapper;

    @Override
    public CategoryDto createCategory(CategoryCreateRequest request, MultipartFile image) {
        String imageId = null;

        // Upload image if provided
        if (image != null && !image.isEmpty()) {
            try {
                imageId = fileStorageClient.uploadImageToFIleSystem(image).getBody();
                log.info("Uploaded image: {}", imageId);
            } catch (Exception e) {
                log.error("Failed to upload image: {}", e.getMessage());
                throw new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Failed to upload image");
            }
        }

        Category category = Category.builder()
                .name(request.getName())
                .description(request.getDescription())
                .imageId(imageId)
                .build();

        Category saved = categoryRepository.save(category);
        log.info("Category created: {}", saved.getId());
        return mapToDtoWithImage(saved);
    }

    @Override
    public CategoryDto updateCategory(CategoryUpdateRequest request, MultipartFile image) {
        Category toUpdate = findCategoryById(request.getId());

        // Store old imageId to delete later if changed
        String oldImageId = toUpdate.getImageId();

        // Update basic fields
        if (request.getName() != null) {
            toUpdate.setName(request.getName());
        }
        if (request.getDescription() != null) {
            toUpdate.setDescription(request.getDescription());
        }

        // Handle image update
        if (image != null && !image.isEmpty()) {
            // Upload new image
            try {
                String newImageId = fileStorageClient.uploadImageToFIleSystem(image).getBody();
                toUpdate.setImageId(newImageId);
                log.info("Uploaded new image: {}", newImageId);

                // Delete old image
                if (oldImageId != null && !oldImageId.isEmpty()) {
                    deleteImageSafely(oldImageId);
                }
            } catch (Exception e) {
                log.error("Failed to upload image: {}", e.getMessage());
                throw new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Failed to upload image");
            }
        }

        Category updated = categoryRepository.save(toUpdate);
        log.info("Category updated: {}", updated.getId());
        return mapToDtoWithImage(updated);
    }

    @Override
    public List<CategoryDto> getAll() {
        return categoryRepository.findAll().stream()
                .map(this::mapToDtoWithImage)
                .collect(Collectors.toList());
    }

    @Override
    public CategoryDto getCategoryById(String id) {
        return mapToDtoWithImage(findCategoryById(id));
    }

    @Override
    public Category findCategoryById(String id) {
        return categoryRepository.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
    }

    @Override
    public void deleteCategory(String id) {
        // Không cho xóa category nếu vẫn còn sản phẩm đang sử dụng category này
        long productCount = productRepository.countByCategory_Id(id);
        if (productCount > 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot delete category because it is assigned to " + productCount + " product(s)");
        }

        // Get category to retrieve imageId before deletion
        Category category = findCategoryById(id);
        String imageId = category.getImageId();

        // Delete category
        categoryRepository.deleteById(id);
        log.info("Category deleted: {}", id);

        // Delete associated image if exists
        if (imageId != null && !imageId.isEmpty()) {
            deleteImageSafely(imageId);
        }
    }

    /**
     * Map Category entity to CategoryDto with imageUrl
     */
    private CategoryDto mapToDtoWithImage(Category category) {
        CategoryDto dto = modelMapper.map(category, CategoryDto.class);

        // Build imageUrl from imageId
        if (category.getImageId() != null && !category.getImageId().isEmpty()) {
            // Build relative URL for file-storage
            dto.setImageUrl("/v1/file-storage/get/" + category.getImageId());
        }

        return dto;
    }

    /**
     * Delete image safely (don't throw exception)
     */
    private void deleteImageSafely(String imageId) {
        try {
            fileStorageClient.deleteImageFromFileSystem(imageId);
            log.info("Deleted image: {}", imageId);
        } catch (Exception e) {
            // Log warning but don't fail the request
            log.warn("Failed to delete image {}: {}", imageId, e.getMessage());
        }
    }
}
