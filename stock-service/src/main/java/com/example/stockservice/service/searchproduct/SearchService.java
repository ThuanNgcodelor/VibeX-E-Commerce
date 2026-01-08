package com.example.stockservice.service.searchproduct;

import com.example.stockservice.dto.ProductDto;
import com.example.stockservice.dto.SizeDto;
import com.example.stockservice.dto.search.*;
import com.example.stockservice.enums.ProductStatus;
import com.example.stockservice.model.Product;
import com.example.stockservice.repository.ProductRepository;
import com.example.stockservice.repository.ReviewRepository;
import com.example.stockservice.service.analytic.AnalyticsRedisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    private final ProductRepository productRepository;
    private final SmartSearchService smartSearchService;
    private final SearchCacheService searchCacheService;
    private final SearchHistoryService searchHistoryService;
    private final AnalyticsRedisService analyticsRedisService;
    private final ReviewRepository reviewRepository;

    /**
     * Main search method
     * 
     * @param request SearchRequest
     * @param userId  User ID (nullable nếu guest)
     * @return SearchResponse with products and metadata
     */
    public SearchResponse search(SearchRequest request, String userId) {
        log.info("Search request: query='{}', userId='{}', page={}",
                request.getQuery(), userId, request.getPage());

        // 1. Parse query using SmartSearchService
        SearchCriteria criteria = smartSearchService.parseQuery(request.getQuery());

        // 2. Merge với filters từ UI
        mergeFiltersIntoCriteria(criteria, request.getFilters());

        // 3. Check cache
        String normalizedQuery = request.getQuery() != null ? request.getQuery().trim().toLowerCase() : "";
        List<ProductDto> cachedProducts = searchCacheService.getCachedResults(normalizedQuery, request.getFilters());

        boolean fromCache = false;
        List<ProductDto> allResults;

        if (cachedProducts != null && request.getPage() == 0) {
            // Cache hit và đang ở page đầu tiên
            allResults = cachedProducts;
            fromCache = true;
            log.debug("Using cached results: {} items", allResults.size());
        } else {
            // Cache miss hoặc page > 0 → query database
            allResults = searchDatabase(criteria, request.getSortBy());

            // Cache results cho page đầu tiên
            if (request.getPage() == 0 && !allResults.isEmpty()) {
                searchCacheService.cacheSearchResults(normalizedQuery, request.getFilters(), allResults);
            }
        }

        // 4. Save search history (nếu có userId và query không rỗng)
        if (userId != null && !normalizedQuery.isEmpty()) {
            searchHistoryService.addSearchHistory(userId, normalizedQuery);
        }

        // 5. Track search trong analytics
        if (!normalizedQuery.isEmpty()) {
            analyticsRedisService.incrementSearchCount(normalizedQuery);
        }

        // 6. Apply pagination
        int page = request.getPage();
        int size = request.getSize();
        int start = page * size;
        int end = Math.min(start + size, allResults.size());

        List<ProductDto> pageResults = allResults.subList(start, end);
        int totalPages = (int) Math.ceil((double) allResults.size() / size);

        // 7. Build response
        return SearchResponse.builder()
                .products(pageResults)
                .total((long) allResults.size())
                .page(page)
                .size(size)
                .totalPages(totalPages)
                .cached(fromCache)
                .parsedCriteria(criteria)
                .build();
    }

    /**
     * Get autocomplete suggestions
     * 
     * @param query  Partial query
     * @param userId User ID (nullable)
     * @param limit  Max suggestions
     * @return AutocompleteResponse
     */
    public AutocompleteResponse getAutocomplete(String query, String userId, int limit) {
        List<AutocompleteResponse.Suggestion> suggestions = new ArrayList<>();

        if (query == null || query.trim().isEmpty()) {
            // Empty query → return search history
            if (userId != null) {
                List<String> history = searchHistoryService.getSearchHistory(userId, limit);
                history.forEach(h -> suggestions.add(
                        AutocompleteResponse.Suggestion.builder()
                                .text(h)
                                .type("history")
                                .build()));
            }
            return AutocompleteResponse.builder().suggestions(suggestions).build();
        }

        String normalizedQuery = query.trim().toLowerCase();

        // 1. Product name suggestions
        List<Product> products = productRepository.searchProductByName(normalizedQuery);
        products.stream()
                .filter(p -> p.getStatus() == ProductStatus.IN_STOCK)
                .limit(Math.max(5, limit / 2))
                .forEach(p -> suggestions.add(
                        AutocompleteResponse.Suggestion.builder()
                                .text(p.getName())
                                .type("product")
                                .productId(p.getId())
                                .build()));

        // 2. Category suggestionscó thể add thêm)
        // TODO: có thể thêm category suggestions nếu cần

        // 3. Search history matching query
        if (userId != null) {
            List<String> history = searchHistoryService.getSearchHistory(userId, 10);
            history.stream()
                    .filter(h -> h.contains(normalizedQuery))
                    .limit(3)
                    .forEach(h -> suggestions.add(
                            AutocompleteResponse.Suggestion.builder()
                                    .text(h)
                                    .type("history")
                                    .build()));
        }

        // 4. Remove duplicates by text
        List<AutocompleteResponse.Suggestion> uniqueSuggestions = suggestions.stream()
                .collect(Collectors.toMap(
                        AutocompleteResponse.Suggestion::getText,
                        s -> s,
                        (s1, s2) -> s1.getType().equals("product") ? s1 : s2))
                .values()
                .stream()
                .limit(limit)
                .collect(Collectors.toList());

        return AutocompleteResponse.builder()
                .suggestions(uniqueSuggestions)
                .build();
    }

    /**
     * Merge filters từ UI vào SearchCriteria
     */
    private void mergeFiltersIntoCriteria(SearchCriteria criteria, SearchFilters filters) {
        if (filters == null)
            return;

        // Price (ưu tiên filters từ UI nếu có)
        if (filters.getPriceMin() != null) {
            criteria.setPriceMin(filters.getPriceMin());
        }
        if (filters.getPriceMax() != null) {
            criteria.setPriceMax(filters.getPriceMax());
        }

        // Categories
        if (filters.getCategories() != null && !filters.getCategories().isEmpty()) {
            List<String> merged = new ArrayList<>(criteria.getCategories());
            merged.addAll(filters.getCategories());
            criteria.setCategories(merged.stream().distinct().collect(Collectors.toList()));
        }

        // Sizes
        if (filters.getSizes() != null && !filters.getSizes().isEmpty()) {
            List<String> merged = new ArrayList<>(criteria.getSizes());
            merged.addAll(filters.getSizes());
            criteria.setSizes(merged.stream().distinct().collect(Collectors.toList()));
        }

        // Locations
        if (filters.getLocations() != null && !filters.getLocations().isEmpty()) {
            List<String> merged = new ArrayList<>(criteria.getLocations());
            merged.addAll(filters.getLocations());
            criteria.setLocations(merged.stream().distinct().collect(Collectors.toList()));
        }
    }

    /**
     * Search database với criteria
     */
    private List<ProductDto> searchDatabase(SearchCriteria criteria, String sortBy) {
        // Get all IN_STOCK products
        List<Product> allProducts = productRepository.findAllWithSizes();

        // Filter by status
        List<Product> filtered = allProducts.stream()
                .filter(p -> p.getStatus() == ProductStatus.IN_STOCK)
                .collect(Collectors.toList());

        // Apply search criteria filters
        filtered = applySearchCriteria(filtered, criteria);

        // Sort
        filtered = applySorting(filtered, sortBy);

        // Convert to DTOs
        return filtered.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Apply search criteria filters
     */
    private List<Product> applySearchCriteria(List<Product> products, SearchCriteria criteria) {
        return products.stream()
                .filter(p -> matchesKeywords(p, criteria.getKeywords()))
                .filter(p -> matchesPriceRange(p, criteria.getPriceMin(), criteria.getPriceMax()))
                .filter(p -> matchesCategories(p, criteria.getCategories()))
                .filter(p -> matchesSizes(p, criteria.getSizes()))
                .collect(Collectors.toList());
    }

    /**
     * Check if product matches keywords
     */
    private boolean matchesKeywords(Product p, List<String> keywords) {
        if (keywords == null || keywords.isEmpty()) {
            return true;
        }

        String productText = (p.getName() + " " + (p.getDescription() != null ? p.getDescription() : ""))
                .toLowerCase();

        return keywords.stream()
                .allMatch(kw -> productText.contains(kw.toLowerCase()));
    }

    /**
     * Check if product price in range
     */
    private boolean matchesPriceRange(Product p, Double min, Double max) {
        if (min == null && max == null)
            return true;

        double price = p.getPrice();
        if (min != null && price < min)
            return false;
        if (max != null && price > max)
            return false;

        return true;
    }

    /**
     * Check if product matches categories
     */
    private boolean matchesCategories(Product p, List<String> categories) {
        if (categories == null || categories.isEmpty()) {
            return true;
        }

        if (p.getCategory() == null)
            return false;

        String categoryName = p.getCategory().getName();
        return categories.stream()
                .anyMatch(c -> c.equalsIgnoreCase(categoryName));
    }

    /**
     * Check if product has matching sizes
     */
    private boolean matchesSizes(Product p, List<String> sizes) {
        if (sizes == null || sizes.isEmpty()) {
            return true;
        }

        if (p.getSizes() == null || p.getSizes().isEmpty()) {
            return false;
        }

        return p.getSizes().stream()
                .anyMatch(size -> sizes.stream()
                        .anyMatch(s -> s.equalsIgnoreCase(size.getName())));
    }

    /**
     * Apply sorting
     */
    private List<Product> applySorting(List<Product> products, String sortBy) {
        if (sortBy == null || sortBy.equals("relevance")) {
            return products; // No specific sorting
        }

        Comparator<Product> comparator;
        switch (sortBy.toLowerCase()) {
            case "price-asc":
                comparator = Comparator.comparingDouble(Product::getPrice);
                break;
            case "price-desc":
                comparator = Comparator.comparingDouble(Product::getPrice).reversed();
                break;
            case "newest":
                comparator = Comparator.comparing(Product::getCreatedTimestamp).reversed();
                break;
            // case "bestselling": // Cần thêm field soldCount
            // comparator = Comparator.comparingInt(Product::getSoldCount).reversed();
            // break;
            default:
                return products;
        }

        return products.stream()
                .sorted(comparator)
                .collect(Collectors.toList());
    }

    /**
     * Convert Product entity to ProductDto
     */
    private ProductDto convertToDto(Product p) {
        List<SizeDto> sizeDtos = p.getSizes() != null
                ? p.getSizes().stream()
                        .map(size -> SizeDto.builder()
                                .id(size.getId())
                                .name(size.getName())
                                .stock(size.getStock())
                                .build())
                        .collect(Collectors.toList())
                : new ArrayList<>();

        Integer totalStock = sizeDtos.stream()
                .mapToInt(SizeDto::getStock)
                .sum();

        // Get analytics data
        Integer soldCount = 0; // TODO: Get from order history if available
        Double averageRating = reviewRepository.getAverageRatingByProductId(p.getId());

        return ProductDto.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .price(p.getPrice())
                .originalPrice(p.getOriginalPrice())
                .discountPercent(p.getDiscountPercent())
                .imageId(p.getImageId())
                .imageIds(p.getImageIds())
                .status(p.getStatus())
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : null)
                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                .userId(p.getUserId())
                .sizes(sizeDtos)
                .totalStock(totalStock)
                .createdAt(p.getCreatedTimestamp())
                .soldCount(soldCount)
                .averageRating(averageRating)
                .build();
    }
}
