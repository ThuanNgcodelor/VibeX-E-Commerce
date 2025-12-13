/**
 * Utility function to translate product attribute names
 * This helps translate common attribute names like "Material", "Brand", "Origin", etc.
 * to their localized versions based on the current language.
 * 
 * @param {string} attributeKey - The attribute key/name (e.g., "Material", "Brand", "RAM")
 * @param {Function} t - The translation function from useTranslation hook
 * @returns {string} - Translated attribute name or original if translation not found
 */
export const translateAttributeName = (attributeKey, t) => {
  if (!attributeKey) return attributeKey;
  
  // Normalize the key (trim, capitalize first letter)
  const normalizedKey = attributeKey.trim();
  const lowerKey = normalizedKey.toLowerCase();
  
  // Map of common attribute keys to translation keys
  const attributeMap = {
    'category': 'shopOwner.attributes.category',
    'stock': 'shopOwner.attributes.stock',
    'condition': 'shopOwner.attributes.condition',
    'ram': 'shopOwner.attributes.ram',
    'memorytype': 'shopOwner.attributes.memoryType',
    'memory type': 'shopOwner.attributes.memoryType',
    'warrantyduration': 'shopOwner.attributes.warrantyDuration',
    'warranty duration': 'shopOwner.attributes.warrantyDuration',
    'warrantytype': 'shopOwner.attributes.warrantyType',
    'warranty type': 'shopOwner.attributes.warrantyType',
    'rom': 'shopOwner.attributes.rom',
    'manufacturername': 'shopOwner.attributes.manufacturerName',
    'manufacturer name': 'shopOwner.attributes.manufacturerName',
    'manufactureraddress': 'shopOwner.attributes.manufacturerAddress',
    'manufacturer address': 'shopOwner.attributes.manufacturerAddress',
    'customproduct': 'shopOwner.attributes.customProduct',
    'custom product': 'shopOwner.attributes.customProduct',
    'dimension': 'shopOwner.attributes.dimension',
    'manufacturedate': 'shopOwner.attributes.manufactureDate',
    'manufacture date': 'shopOwner.attributes.manufactureDate',
    'memoryclockspeed': 'shopOwner.attributes.memoryClockSpeed',
    'memory clock speed': 'shopOwner.attributes.memoryClockSpeed',
    'sentfrom': 'shopOwner.attributes.sentFrom',
    'sent from': 'shopOwner.attributes.sentFrom',
    'shipsfrom': 'shopOwner.attributes.shipsFrom',
    'ships from': 'shopOwner.attributes.shipsFrom',
    'brand': 'shopOwner.attributes.brand',
    'formula': 'shopOwner.attributes.formula',
    'material': 'shopOwner.attributes.material',
    'origin': 'shopOwner.attributes.origin',
    'color': 'shopOwner.attributes.color',
    'size': 'shopOwner.attributes.size',
    'weight': 'shopOwner.attributes.weight',
    'warranty': 'shopOwner.attributes.warranty',
    'discountstock': 'shopOwner.attributes.discountStock',
    'discount stock': 'shopOwner.attributes.discountStock',
    'otherstock': 'shopOwner.attributes.otherStock',
    'other stock': 'shopOwner.attributes.otherStock',
    'pattern': 'shopOwner.attributes.pattern',
    'tallfit': 'shopOwner.attributes.tallFit',
    'tall fit': 'shopOwner.attributes.tallFit',
    'sleevelength': 'shopOwner.attributes.sleeveLength',
    'sleeve length': 'shopOwner.attributes.sleeveLength',
    'topfittype': 'shopOwner.attributes.topFitType',
    'top fit type': 'shopOwner.attributes.topFitType',
    'neckline': 'shopOwner.attributes.neckline',
    'plussize': 'shopOwner.attributes.plusSize',
    'plus size': 'shopOwner.attributes.plusSize',
    'season': 'shopOwner.attributes.season',
  };
  
  // Try to find translation key
  const translationKey = attributeMap[lowerKey];
  
  if (translationKey) {
    try {
      const translated = t(translationKey);
      // If translation returns the key itself, it means translation not found
      // Return original in that case
      if (translated === translationKey) {
        return normalizedKey;
      }
      return translated;
    } catch (error) {
      // If translation fails, return original
      return normalizedKey;
    }
  }
  
  // If no mapping found, return original (capitalize first letter for better display)
  return normalizedKey.charAt(0).toUpperCase() + normalizedKey.slice(1);
};

/**
 * Translate attribute values for common cases
 * For example: "New" -> translated "New", "Used" -> translated "Used"
 * 
 * @param {string} attributeKey - The attribute key
 * @param {string} attributeValue - The attribute value
 * @param {Function} t - The translation function
 * @returns {string} - Translated value or original
 */
export const translateAttributeValue = (attributeKey, attributeValue, t) => {
  if (!attributeValue) return attributeValue;
  
  const lowerKey = (attributeKey || '').toLowerCase();
  const lowerValue = attributeValue.toLowerCase().trim();
  
  // Special handling for condition values
  if (lowerKey.includes('condition')) {
    if (lowerValue === 'new') {
      return t('shopOwner.attributes.new');
    }
    if (lowerValue === 'used') {
      return t('shopOwner.attributes.used');
    }
  }
  
  // Special handling for warranty type
  if (lowerKey.includes('warranty') && lowerKey.includes('type')) {
    if (lowerValue.includes('manufacturer')) {
      return t('shopOwner.attributes.manufacturerWarranty');
    }
  }
  
  // Stock status
  if (lowerKey.includes('stock')) {
    if (lowerValue === 'in stock' || lowerValue === 'instock') {
      return t('shopOwner.attributes.inStock');
    }
    if (lowerValue === 'out of stock' || lowerValue === 'outofstock') {
      return t('shopOwner.attributes.outOfStock');
    }
  }
  
  // Sleeve length
  if (lowerKey.includes('sleeve')) {
    if (lowerValue.includes('short')) {
      return t('shopOwner.attributes.shortSleeves');
    }
    if (lowerValue.includes('long')) {
      return t('shopOwner.attributes.longSleeves');
    }
  }
  
  // Fit type
  if (lowerKey.includes('fit')) {
    if (lowerValue === 'loose') {
      return t('shopOwner.attributes.loose');
    }
    if (lowerValue === 'tight') {
      return t('shopOwner.attributes.tight');
    }
  }
  
  // Neckline
  if (lowerKey.includes('neckline') || lowerKey.includes('neck')) {
    if (lowerValue.includes('round')) {
      return t('shopOwner.attributes.roundNeck');
    }
    if (lowerValue.includes('v')) {
      return t('shopOwner.attributes.vNeck');
    }
  }
  
  // Season
  if (lowerKey.includes('season')) {
    const seasonMap = {
      'summer': 'shopOwner.attributes.summer',
      'winter': 'shopOwner.attributes.winter',
      'spring': 'shopOwner.attributes.spring',
      'autumn': 'shopOwner.attributes.autumn',
      'fall': 'shopOwner.attributes.autumn',
    };
    if (seasonMap[lowerValue]) {
      return t(seasonMap[lowerValue]);
    }
  }
  
  // Pattern
  if (lowerKey.includes('pattern')) {
    if (lowerValue === 'print') {
      return t('shopOwner.attributes.print');
    }
    if (lowerValue === 'solid') {
      return t('shopOwner.attributes.solid');
    }
    if (lowerValue === 'striped') {
      return t('shopOwner.attributes.striped');
    }
  }
  
  // Special handling for yes/no values
  if (lowerValue === 'yes' || lowerValue === 'true') {
    return t('shopOwner.attributes.yes');
  }
  if (lowerValue === 'no' || lowerValue === 'false') {
    return t('shopOwner.attributes.no');
  }
  
  // Special handling for "updating" value
  if (lowerValue === 'updating') {
    return t('shopOwner.attributes.updating');
  }
  
  // Category path handling (e.g., "Shopee > Men Clothes > Tops")
  if (lowerKey === 'category' && attributeValue.includes('>')) {
    // Keep category path as is, or translate each part if needed
    return attributeValue; // Or implement category translation
  }
  
  // Return original if no special handling
  return attributeValue;
};

/**
 * Get list of common attribute keys for dropdown
 * @returns {string[]} Array of attribute keys
 */
export const getCommonAttributeKeys = () => {
  return [
    'Category',
    'Brand',
    'Material',
    'Origin',
    'Color',
    'Size',
    'Weight',
    'Condition',
    'Pattern',
    'Sleeve Length',
    'Top Fit Type',
    'Neckline',
    'Tall Fit',
    'Plus Size',
    'Season',
    'Ships From',
    'Discount Stock',
    'Other Stock',
    'Warranty',
    'Warranty Duration',
    'Warranty Type',
    'RAM',
    'ROM',
    'Memory Type',
    'Memory Clock Speed',
    'Dimension',
    'Manufacture Date',
    'Manufacturer Name',
    'Manufacturer Address',
    'Custom Product',
  ];
};

