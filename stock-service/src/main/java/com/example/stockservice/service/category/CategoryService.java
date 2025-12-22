package com.example.stockservice.service.category;

import com.example.stockservice.dto.CategoryDto;
import com.example.stockservice.model.Category;
import com.example.stockservice.request.category.CategoryCreateRequest;
import com.example.stockservice.request.category.CategoryUpdateRequest;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface CategoryService {
    CategoryDto createCategory(CategoryCreateRequest request, MultipartFile image);

    CategoryDto updateCategory(CategoryUpdateRequest request, MultipartFile image);

    List<CategoryDto> getAll();

    CategoryDto getCategoryById(String id);

    Category findCategoryById(String id);

    void deleteCategory(String id);
}
