package com.example.stockservice.controller;

import com.example.stockservice.dto.CategoryDto;
import com.example.stockservice.request.category.CategoryCreateRequest;
import com.example.stockservice.request.category.CategoryUpdateRequest;
import com.example.stockservice.service.category.CategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/v1/stock/category")
@RequiredArgsConstructor
public class CategoryController {
    private final CategoryService categoryService;

    @GetMapping("/getAll")
    public ResponseEntity<List<CategoryDto>> getAll() {
        List<CategoryDto> categoryDtos = categoryService.getAll();
        return ResponseEntity.ok(categoryDtos);
    }

    @GetMapping("/getCategoryById/{id}")
    public ResponseEntity<CategoryDto> getCategoryById(@PathVariable String id) {
        CategoryDto categoryDto = categoryService.getCategoryById(id);
        return ResponseEntity.ok(categoryDto);
    }

    @PostMapping(value = "/create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CategoryDto> createCategory(
            @RequestPart("request") @Valid CategoryCreateRequest request,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        CategoryDto categoryDto = categoryService.createCategory(request, image);
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryDto);
    }

    @PutMapping(value = "/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CategoryDto> updateCategory(
            @RequestPart("request") @Valid CategoryUpdateRequest request,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        CategoryDto categoryDto = categoryService.updateCategory(request, image);
        return ResponseEntity.ok(categoryDto);
    }

    @DeleteMapping("/deleteCategoryById/{id}")
    public ResponseEntity<Void> deleteCategoryById(@PathVariable String id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.status(HttpStatus.OK).build();
    }
}
