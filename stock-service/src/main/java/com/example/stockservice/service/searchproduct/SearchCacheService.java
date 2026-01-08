package com.example.stockservice.service.searchproduct;

import com.example.stockservice.dto.ProductDto;
import com.example.stockservice.dto.search.SearchFilters;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Service quản lý Redis cache cho search results
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SearchCacheService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String SEARCH_CACHE_PREFIX = "search:cache:";
    private static final long CACHE_TTL_HOURS = 24; // Cache 24 giờ
    private static final int MAX_CACHED_ITEMS = 20; // Chỉ cache 20 items đầu tiên

    /**
     * Cache search results
     * 
     * @param query    Normalized query string
     * @param filters  Search filters
     * @param products List products (sẽ chỉ lưu max 20 items)
     */
    public void cacheSearchResults(String query, SearchFilters filters, List<ProductDto> products) {
        if (query == null || query.trim().isEmpty()) {
            return;
        }

        try {
            String cacheKey = generateCacheKey(query, filters);

            // Chỉ cache tối đa MAX_CACHED_ITEMS
            List<ProductDto> toCache = products.size() > MAX_CACHED_ITEMS
                    ? products.subList(0, MAX_CACHED_ITEMS)
                    : products;

            // Convert to JSON string
            String json = objectMapper.writeValueAsString(toCache);

            redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL_HOURS, TimeUnit.HOURS);
            log.debug("Cached search results for key: {} ({} items)", cacheKey, toCache.size());
        } catch (Exception e) {
            log.warn("Failed to cache search results: {}", e.getMessage());
        }
    }

    /**
     * Lấy cached search results
     * 
     * @param query   Normalized query string
     * @param filters Search filters
     * @return List products hoặc null nếu cache miss
     */
    public List<ProductDto> getCachedResults(String query, SearchFilters filters) {
        if (query == null || query.trim().isEmpty()) {
            return null;
        }

        try {
            String cacheKey = generateCacheKey(query, filters);
            Object cached = redisTemplate.opsForValue().get(cacheKey);

            if (cached == null) {
                log.debug("Cache miss for key: {}", cacheKey);
                return null;
            }

            // Parse JSON back to List<ProductDto>
            String json = cached.toString();
            List<ProductDto> products = objectMapper.readValue(json, new TypeReference<List<ProductDto>>() {
            });

            log.debug("Cache hit for key: {} ({} items)", cacheKey, products.size());
            return products;
        } catch (Exception e) {
            log.warn("Failed to get cached results: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Invalidate cache cho một query
     * 
     * @param query Query string
     */
    public void invalidateCache(String query) {
        if (query == null || query.trim().isEmpty()) {
            return;
        }

        try {
            // Xóa tất cả keys bắt đầu bằng "search:cache:{normalizedQuery}:*"
            String pattern = SEARCH_CACHE_PREFIX + normalizeQuery(query) + ":*";
            redisTemplate.keys(pattern).forEach(key -> {
                redisTemplate.delete(key);
                log.debug("Invalidated cache key: {}", key);
            });
        } catch (Exception e) {
            log.error("Failed to invalidate cache: {}", e.getMessage());
        }
    }

    /**
     * Generate cache key từ query và filters
     * Format: "search:cache:{normalizedQuery}:{filterHash}"
     */
    private String generateCacheKey(String query, SearchFilters filters) {
        String normalizedQuery = normalizeQuery(query);
        String filterHash = generateFilterHash(filters);
        return SEARCH_CACHE_PREFIX + normalizedQuery + ":" + filterHash;
    }

    /**
     * Normalize query string (lowercase, trim)
     */
    private String normalizeQuery(String query) {
        if (query == null)
            return "empty";
        return query.trim().toLowerCase().replaceAll("\\s+", "_");
    }

    /**
     * Generate hash từ filters để làm cache key
     */
    private String generateFilterHash(SearchFilters filters) {
        if (filters == null) {
            return "nofilters";
        }

        try {
            // Serialize filters to JSON
            String filtersJson = objectMapper.writeValueAsString(filters);

            // Generate MD5 hash
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hashBytes = md.digest(filtersJson.getBytes(StandardCharsets.UTF_8));

            // Convert to hex string
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            log.warn("Failed to generate filter hash: {}", e.getMessage());
            return "hashfail";
        }
    }

    /**
     * Check if cache key exists
     */
    public boolean isCached(String query, SearchFilters filters) {
        try {
            String cacheKey = generateCacheKey(query, filters);
            return Boolean.TRUE.equals(redisTemplate.hasKey(cacheKey));
        } catch (Exception e) {
            return false;
        }
    }
}
