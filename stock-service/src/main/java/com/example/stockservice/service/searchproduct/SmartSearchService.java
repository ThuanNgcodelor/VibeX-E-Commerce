package com.example.stockservice.service.searchproduct;

import com.example.stockservice.dto.search.SearchCriteria;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service xử lý parse query thông minh
 * Support cả tiếng Việt và tiếng Anh
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SmartSearchService {
    
    // ============ PRICE PATTERNS ============
    // Các pattern để nhận dạng giá trong query
    private static final List<PricePattern> PRICE_PATTERNS = Arrays.asList(
        // "100k", "500k", "1.5tr", "2tr"
        new PricePattern(
            Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*([kKtTrR])", Pattern.CASE_INSENSITIVE),
            (m) -> parseVietnamesePrice(m.group(1), m.group(2))
        ),
        // "100.000", "1.500.000", "100,000" 
        new PricePattern(
            Pattern.compile("(\\d{1,3}(?:[.,]\\d{3})+)", Pattern.CASE_INSENSITIVE),
            (m) -> parseFormattedPrice(m.group(1))
        ),
        // "từ 100k đến 500k", "from 100k to 500k"
        new PricePattern(
            Pattern.compile("(?:từ|from)\\s+(\\d+(?:[.,]\\d+)?)\\s*([kKtTrR]?)\\s+(?:đến|to)\\s+(\\d+(?:[.,]\\d+)?)\\s*([kKtTrR]?)", Pattern.CASE_INSENSITIVE),
            null // Xử lý riêng trong extractPriceRange
        ),
        // "dưới 500k", "under 500k", "below 500k"
        new PricePattern(
            Pattern.compile("(?:dưới|under|below)\\s+(\\d+(?:[.,]\\d+)?)\\s*([kKtTrR]?)", Pattern.CASE_INSENSITIVE),
            null // Max price only
        ),
        // "trên 100k", "above 100k", "over 100k"
        new PricePattern(
            Pattern.compile("(?:trên|above|over)\\s+(\\d+(?:[.,]\\d+)?)\\s*([kKtTrR]?)", Pattern.CASE_INSENSITIVE),
            null // Min price only
        )
    );
    
    // ============ CATEGORY MAPPINGS ============
    // Map từ keywords → category name (hỗ trợ cả tiếng Việt và tiếng Anh)
    private static final Map<String, String> CATEGORY_KEYWORDS = new HashMap<>() {{
        // Electronics
        put("máy ảnh", "Camera");
        put("camera", "Camera");
        put("laptop", "Laptop");
        put("máy tính", "Laptop");
        put("điện thoại", "Phone");
        put("phone", "Phone");
        put("smartphone", "Phone");
        put("tai nghe", "Headphones");
        put("headphone", "Headphones");
        put("earphone", "Headphones");
        
        // Clothing
        put("áo", "Clothing");
        put("áo thun", "T-Shirt");
        put("t-shirt", "T-Shirt");
        put("tshirt", "T-Shirt");
        put("quần", "Pants");
        put("pants", "Pants");
        put("jeans", "Jeans");
        put("váy", "Dress");
        put("dress", "Dress");
        put("hoodie", "Hoodie");
        put("áo hoodie", "Hoodie");
        
        // Home & Living
        put("đồ gia dụng", "Home & Living");
        put("nội thất", "Furniture");
        put("furniture", "Furniture");
        
        // Toys
        put("đồ chơi", "Toys");
        put("toy", "Toys");
        put("lego", "Toys");
        
        // Beauty
        put("mỹ phẩm", "Beauty");
        put("makeup", "Beauty");
        put("cosmetic", "Beauty");
        
        // Books
        put("sách", "Books");
        put("book", "Books");
    }};
    
    // ============ SIZE PATTERNS ============
    private static final Pattern SIZE_PATTERN = Pattern.compile(
        "\\b(?:size\\s+)?([XSMLXL]{1,3}|\\d{2,3})\\b", 
        Pattern.CASE_INSENSITIVE
    );
    
    // ============ LOCATION KEYWORDS ============
    private static final Set<String> LOCATIONS = new HashSet<>(Arrays.asList(
        "hà nội", "hanoi", "tp hcm", "hồ chí minh", "ho chi minh", "sài gòn", "saigon",
        "đà nẵng", "da nang", "hải phòng", "hai phong", "cần thơ", "can tho"
    ));
    
    /**
     * Parse query chính
     * @param rawQuery Query gốc từ user
     * @return SearchCriteria object
     */
    public SearchCriteria parseQuery(String rawQuery) {
        if (rawQuery == null || rawQuery.trim().isEmpty()) {
            return SearchCriteria.builder()
                .originalQuery(rawQuery)
                .build();
        }
        
        String query = rawQuery.trim();
        log.debug("Parsing query: {}", query);
        
        SearchCriteria criteria = SearchCriteria.builder()
            .originalQuery(rawQuery)
            .build();
        
        // 1. Extract price range
        PriceRange priceRange = extractPriceRange(query);
        criteria.setPriceMin(priceRange.min);
        criteria.setPriceMax(priceRange.max);
        
        // Remove price patterns from query
        query = removePricePatterns(query);
        
        // 2. Extract categories - DISABLED to prevent strict filtering mismatch
        // List<String> categories = extractCategories(query);
        // criteria.setCategories(categories);
        
        // Remove category keywords from query
        // query = removeCategoryKeywords(query);
        
        // 3. Extract sizes - DISABLED
        // List<String> sizes = extractSizes(query);
        // criteria.setSizes(sizes);
        
        // Remove size patterns from query
        // query = removeSizePatterns(query);
        
        // 4. Extract locations - DISABLED
        // List<String> locations = extractLocations(query);
        // criteria.setLocations(locations);
        
        // Remove location keywords from query
        // query = removeLocationKeywords(query);
        
        // 5. Remaining words = main keywords
        List<String> keywords = Arrays.stream(query.trim().split("\\s+"))
            .filter(w -> !w.isEmpty())
            .collect(Collectors.toList());
        criteria.setKeywords(keywords);
        
        log.debug("Parsed criteria: {}", criteria);
        return criteria;
    }
    
    /**
     * Extract price range từ query
     */
    private PriceRange extractPriceRange(String query) {
        PriceRange result = new PriceRange();
        
        // Pattern: "từ X đến Y", "from X to Y"
        Pattern rangePattern = Pattern.compile(
            "(?:từ|from)\\s+(\\d+(?:[.,]\\d+)?)\\s*([kKtTrR]?)\\s+(?:đến|to)\\s+(\\d+(?:[.,]\\d+)?)\\s*([kKtTrR]?)",
            Pattern.CASE_INSENSITIVE
        );
        Matcher rangeMatcher = rangePattern.matcher(query);
        if (rangeMatcher.find()) {
            result.min = parseVietnamesePrice(rangeMatcher.group(1), rangeMatcher.group(2));
            result.max = parseVietnamesePrice(rangeMatcher.group(3), rangeMatcher.group(4));
            return result;
        }
        
        // Pattern: "dưới X", "under X"
        Pattern underPattern = Pattern.compile(
            "(?:dưới|under|below)\\s+(\\d+(?:[.,]\\d+)?)\\s*([kKtTrR]?)",
            Pattern.CASE_INSENSITIVE
        );
        Matcher underMatcher = underPattern.matcher(query);
        if (underMatcher.find()) {
            result.max = parseVietnamesePrice(underMatcher.group(1), underMatcher.group(2));
            return result;
        }
        
        // Pattern: "trên X", "above X"
        Pattern abovePattern = Pattern.compile(
            "(?:trên|above|over)\\s+(\\d+(?:[.,]\\d+)?)\\s*([kKtTrR]?)",
            Pattern.CASE_INSENSITIVE
        );
        Matcher aboveMatcher = abovePattern.matcher(query);
        if (aboveMatcher.find()) {
            result.min = parseVietnamesePrice(aboveMatcher.group(1), aboveMatcher.group(2));
            return result;
        }
        
        // Single price: "100k", "500.000"
        for (PricePattern pp : PRICE_PATTERNS) {
            Matcher m = pp.pattern.matcher(query);
            if (m.find() && pp.parser != null) {
                Double price = pp.parser.apply(m);
                // Coi là max price
                result.max = price;
                break;
            }
        }
        
        return result;
    }
    
    /**
     * Parse Vietnamese price format: "100k" → 100000, "1.5tr" → 1500000
     */
    private static Double parseVietnamesePrice(String number, String unit) {
        try {
            // Replace comma with dot for decimal parsing
            double base = Double.parseDouble(number.replace(',', '.'));
            
            if (unit.equalsIgnoreCase("k")) {
                return base * 1000;
            } else if (unit.equalsIgnoreCase("tr") || unit.equalsIgnoreCase("r")) {
                return base * 1000000;
            }
            return base;
        } catch (Exception e) {
            log.warn("Failed to parse price: {} {}", number, unit);
            return null;
        }
    }
    
    /**
     * Parse formatted price: "100.000" → 100000
     */
    private static Double parseFormattedPrice(String formatted) {
        try {
            // Remove dots and commas
            String cleaned = formatted.replace(".", "").replace(",", "");
            return Double.parseDouble(cleaned);
        } catch (Exception e) {
            log.warn("Failed to parse formatted price: {}", formatted);
            return null;
        }
    }
    
    /**
     * Extract categories từ query
     */
    private List<String> extractCategories(String query) {
        String normalized = removeVietnameseTones(query.toLowerCase());
        List<String> found = new ArrayList<>();
        
        for (Map.Entry<String, String> entry : CATEGORY_KEYWORDS.entrySet()) {
            String keyword = entry.getKey();
            String keywordNormalized = removeVietnameseTones(keyword.toLowerCase());
            
            // Check cả có dấu và không dấu
            if (query.toLowerCase().contains(keyword) || normalized.contains(keywordNormalized)) {
                found.add(entry.getValue());
            }
        }
        
        return found.stream().distinct().collect(Collectors.toList());
    }
    
    /**
     * Extract sizes từ query
     */
    private List<String> extractSizes(String query) {
        List<String> sizes = new ArrayList<>();
        Matcher matcher = SIZE_PATTERN.matcher(query);
        while (matcher.find()) {
            sizes.add(matcher.group(1).toUpperCase());
        }
        return sizes;
    }
    
    /**
     * Extract locations từ query
     */
    private List<String> extractLocations(String query) {
        String normalized = removeVietnameseTones(query.toLowerCase());
        List<String> found = new ArrayList<>();
        
        for (String location : LOCATIONS) {
            String locNormalized = removeVietnameseTones(location.toLowerCase());
            if (query.toLowerCase().contains(location) || normalized.contains(locNormalized)) {
                found.add(location);
            }
        }
        
        return found;
    }
    
    /**
     * Remove price patterns từ query
     */
    private String removePricePatterns(String query) {
        for (PricePattern pp : PRICE_PATTERNS) {
            query = pp.pattern.matcher(query).replaceAll(" ");
        }
        return query.replaceAll("\\s+", " ").trim();
    }
    
    /**
     * Remove category keywords từ query
     */
    private String removeCategoryKeywords(String query) {
        for (String keyword : CATEGORY_KEYWORDS.keySet()) {
            query = query.replaceAll("(?i)" + Pattern.quote(keyword), " ");
        }
        return query.replaceAll("\\s+", " ").trim();
    }
    
    /**
     * Remove size patterns từ query
     */
    private String removeSizePatterns(String query) {
        return SIZE_PATTERN.matcher(query).replaceAll(" ").replaceAll("\\s+", " ").trim();
    }
    
    /**
     * Remove location keywords từ query
     */
    private String removeLocationKeywords(String query) {
        for (String location : LOCATIONS) {
            query = query.replaceAll("(?i)" + Pattern.quote(location), " ");
        }
        return query.replaceAll("\\s+", " ").trim();
    }
    
    /**
     * Remove Vietnamese tones để compare dễ hơn
     */
    private String removeVietnameseTones(String str) {
        if (str == null) return "";
        
        String normalized = Normalizer.normalize(str, Normalizer.Form.NFD);
        Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        String result = pattern.matcher(normalized).replaceAll("");
        
        // Replace đ → d, Đ → D
        result = result.replace("đ", "d").replace("Đ", "D");
        
        return result;
    }
    
    // ============ HELPER CLASSES ============
    
    private static class PricePattern {
        Pattern pattern;
        java.util.function.Function<Matcher, Double> parser;
        
        PricePattern(Pattern pattern, java.util.function.Function<Matcher, Double> parser) {
            this.pattern = pattern;
            this.parser = parser;
        }
    }
    
    private static class PriceRange {
        Double min;
        Double max;
    }
}
