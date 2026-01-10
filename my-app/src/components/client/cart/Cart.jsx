import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import imgFallback from "../../../assets/images/shop/6.png";

const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

export function Cart({
  items = [],
  imageUrls = {},
  productNames = {},
  shopOwners = {},
  shopOwnerIds = {}, // Map of productId -> shopOwnerId (UUID)
  selected = new Set(),
  onToggle,
  onToggleAll,
  onRemove,
  onQuantityChange,
  onCheckout,
  allChecked = false,
  selectedQuantity = 0,
  selectedSubtotal = 0
}) {
  const { t } = useTranslation();

  // Group items by shop owner - now also track shopOwnerId
  const itemsByShop = {};
  const shopIdMap = {}; // Map shopName -> shopOwnerId
  items.forEach((item) => {
    const pid = item.productId ?? item.id;
    const shopOwnerName = shopOwners[pid] || item.shopOwnerName || item.shopName || 'Unknown Shop';
    const shopOwnerId = shopOwnerIds[pid] || item.shopOwnerId || null;

    if (!itemsByShop[shopOwnerName]) {
      itemsByShop[shopOwnerName] = [];
      shopIdMap[shopOwnerName] = shopOwnerId;
    }
    itemsByShop[shopOwnerName].push(item);
    // Use the first available shopOwnerId for this shop
    if (shopOwnerId && !shopIdMap[shopOwnerName]) {
      shopIdMap[shopOwnerName] = shopOwnerId;
    }
  });

  return (
    <>
      <style>{`
        .cart2-container {
          background: #fff;
          min-height: 100vh;
          padding-bottom: 100px;
        }
        .cart2-header {
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
          padding: 12px 0;
        }
        .cart2-main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .cart2-table {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .cart2-table-header {
          display: grid;
          grid-template-columns: 50px 1fr 150px 120px 150px 100px;
          gap: 20px;
          padding: 16px 20px;
          border-bottom: 1px solid #f0f0f0;
          background: #fafafa;
          font-weight: 600;
          font-size: 14px;
          color: #333;
        }
        .cart2-item {
          display: grid;
          grid-template-columns: 50px 1fr 150px 120px 150px 100px;
          gap: 20px;
          padding: 20px;
          border-bottom: 1px solid #f0f0f0;
          align-items: center;
        }
        .cart2-item:last-child {
          border-bottom: none;
        }
        .cart2-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        .cart2-product {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .cart2-product-image {
          width: 80px;
          height: 80px;
          object-fit: cover;
          border: 1px solid #f0f0f0;
          border-radius: 4px;
        }
        .cart2-product-info {
          flex: 1;
        }
        .cart2-product-name {
          font-size: 14px;
          color: #333;
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .cart2-product-classification {
          font-size: 13px;
          color: #666;
          margin-bottom: 8px;
        }
        .cart2-price {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cart2-price-original {
          font-size: 13px;
          color: #999;
          text-decoration: line-through;
        }
        .cart2-price-current {
          font-size: 16px;
          color: #ee4d2d;
          font-weight: 600;
        }
        .cart2-discount-badge {
          font-size: 11px;
          color: #ee4d2d;
          margin-top: 4px;
        }
        .cart2-quantity {
          display: flex;
          align-items: center;
          border: 1px solid #ddd;
          border-radius: 4px;
          width: fit-content;
        }
        .cart2-quantity-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: #333;
        }
        .cart2-quantity-btn:hover {
          background: #f5f5f5;
        }
        .cart2-quantity-input {
          width: 50px;
          height: 32px;
          border: none;
          border-left: 1px solid #ddd;
          border-right: 1px solid #ddd;
          text-align: center;
          font-size: 14px;
        }
        .cart2-amount {
          font-size: 16px;
          color: #ee4d2d;
          font-weight: 600;
        }
        .cart2-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cart2-action-link {
          color: #333;
          font-size: 13px;
          text-decoration: none;
          cursor: pointer;
        }
        .cart2-action-link:hover {
          color: #ee4d2d;
        }
        .cart2-favorite-section {
          padding: 12px 20px;
          background: #fff5f0;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cart2-deal-shock {
          background: #ff6b35;
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          margin-right: 8px;
        }
        .cart2-voucher-badge {
          position: absolute;
          top: 0;
          left: 0;
          background: #ffd700;
          color: #333;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 0 0 4px 0;
        }
        .cart2-product-image-wrapper {
          position: relative;
        }
        .cart2-bottom {
          background: #fff;
          border-top: 1px solid #f0f0f0;
          padding: 20px;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        }
        .cart2-bottom-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cart2-bottom-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .cart2-bottom-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .cart2-voucher-section {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .cart2-voucher-link {
          color: #ee4d2d;
          text-decoration: none;
          font-size: 14px;
        }
        .cart2-coins-section {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
        }
        .cart2-total {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }
        .cart2-total-label {
          font-size: 14px;
          color: #666;
        }
        .cart2-total-amount {
          font-size: 24px;
          color: #ee4d2d;
          font-weight: 600;
        }
        .cart2-saved {
          font-size: 14px;
          color: #666;
        }
        .cart2-buy-btn {
          background: #ee4d2d;
          color: #fff;
          border: none;
          padding: 14px 40px;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-left: 20px;
          min-width: 180px;
        }
        .cart2-buy-btn:hover {
          background: #d63f21;
        }
        .cart2-shopowner {
          font-size: 12px;
          color: #777;
          margin-top: 4px;
        }
        .cart2-empty {
          text-align: center;
          padding: 60px 20px;
        }
        .cart2-empty-icon {
          font-size: 80px;
          color: #ddd;
          margin-bottom: 20px;
        }
        .cart2-empty-title {
          font-size: 18px;
          color: #666;
          margin-bottom: 10px;
        }
        .cart2-empty-desc {
          font-size: 14px;
          color: #999;
          margin-bottom: 30px;
        }
      `}</style>

      <div className="cart2-container">
        <div className="cart2-main">
          {items.length === 0 ? (
            <div className="cart2-empty">
              <div className="cart2-empty-icon">🛒</div>
              <div className="cart2-empty-title">{t('cart.empty.title')}</div>
              <div className="cart2-empty-desc">{t('cart.empty.description')}</div>
              <Link to="/shop" className="btn btn-primary">
                {t('cart.empty.continueShopping')}
              </Link>
            </div>
          ) : (
            <>
              {/* Global Table Header */}
              <div className="cart2-table" style={{ marginBottom: '0', borderRadius: '4px 4px 0 0' }}>
                <div className="cart2-table-header">
                  <div>
                    <input
                      type="checkbox"
                      className="cart2-checkbox"
                      checked={allChecked}
                      onChange={(e) => onToggleAll(e.target.checked)}
                    />
                  </div>
                  <div>{t('cart2.product')}</div>
                  <div>{t('cart2.unitPrice')}</div>
                  <div>{t('cart2.quantity')}</div>
                  <div>{t('cart2.amount')}</div>
                  <div>{t('cart2.action')}</div>
                </div>
              </div>

              {Object.entries(itemsByShop)
                .sort(([shopNameA], [shopNameB]) => shopNameA.localeCompare(shopNameB))
                .map(([shopName, shopItems]) => (
                  <div key={shopName} className="cart2-table">
                    {/* Shop Header */}
                    <div className="cart2-favorite-section">
                      <input
                        type="checkbox"
                        className="cart2-checkbox"
                        checked={shopItems.every((item) => {
                          const pid = item.productId ?? item.id;
                          const key = `${pid}:${item.sizeId || 'no-size'}`;
                          return selected.has(key);
                        })}
                        onChange={(e) => {
                          shopItems.forEach((item) => {
                            const pid = item.productId ?? item.id;
                            const key = `${pid}:${item.sizeId || 'no-size'}`;
                            onToggle(key, e.target.checked);
                          });
                        }}
                      />
                      <span
                        style={{
                          fontWeight: 600,
                          marginLeft: '8px',
                          cursor: 'pointer',
                          color: '#333'
                        }}
                        onClick={() => {
                          const shopId = shopIdMap[shopName];
                          if (shopId) {
                            window.location.href = `/shop/${shopId}`;
                          }
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#ee4d2d'}
                        onMouseLeave={(e) => e.target.style.color = '#333'}
                      >
                        {shopName}
                      </span>
                    </div>

                    {/* Deal Shock Section */}
                    <div style={{ padding: '12px 20px', background: '#fff5f0', borderBottom: '1px solid #f0f0f0' }}>
                      <span className="cart2-deal-shock">{t('cart2.dealShock')}</span>
                      <span style={{ fontSize: '13px', color: '#666' }}>{t('cart2.buyWithDeal')}</span>
                    </div>

                    {/* Products in this shop */}
                    {shopItems.map((item) => {
                      const pid = item.productId ?? item.id;
                      const uniqueKey = `${pid}:${item.sizeId || 'no-size'}`;
                      const img = imageUrls[pid] ?? imgFallback;
                      const isSelected = selected.has(uniqueKey);

                      return (
                        <div key={uniqueKey} className="cart2-item">
                          <div>
                            <input
                              type="checkbox"
                              className="cart2-checkbox"
                              checked={isSelected}
                              onChange={(e) => onToggle(uniqueKey, e.target.checked)}
                              disabled={item.productAvailable === false || item.sizeAvailable === false || item.availableStock === 0}
                            />
                          </div>
                          <div className="cart2-product">
                            <div className="cart2-product-image-wrapper">
                              <img
                                src={img || imgFallback}
                                alt={productNames[pid] || item.productName || "Product"}
                                className="cart2-product-image"
                                onError={(e) => (e.currentTarget.src = imgFallback)}
                              />
                            </div>
                            <div className="cart2-product-info">
                              <div className="cart2-product-name">
                                {productNames[pid] || item.productName || pid}
                              </div>
                              <div className="cart2-product-classification">
                                {t('cart2.classification')}: {item.sizeName || 'N/A'}
                              </div>
                              {(() => {
                                const isFlashSale = item.isFlashSale === true;
                                console.log(`[Cart Badge] Product ${item.productId}: isFlashSale=${item.isFlashSale}, showing badge=${isFlashSale}`);
                                return isFlashSale ? (
                                  <div style={{
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    borderRadius: '3px',
                                    marginTop: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    boxShadow: '0 2px 4px rgba(238, 77, 45, 0.3)'
                                  }}>
                                    ⚡ Flash Sale
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          <div className="cart2-price">

                            {item.originalPrice && item.originalPrice > item.unitPrice && (
                              <span className="cart2-price-original">
                                {formatVND(item.originalPrice)}
                              </span>
                            )}
                            {item.priceChanged && item.unitPrice && (
                              <span className="cart2-price-original" style={{ textDecoration: 'line-through', color: '#888' }}>
                                {formatVND(item.unitPrice)}
                              </span>
                            )}
                            <span className="cart2-price-current">
                              {formatVND(item.unitPrice || item.price || 0)}
                            </span>
                          </div>
                          <div>
                            <div className="cart2-quantity">
                              <button
                                className="cart2-quantity-btn"
                                onClick={() => onQuantityChange(item, Math.max(1, item.quantity - 1))}
                                disabled={item.productAvailable === false || item.sizeAvailable === false || item.availableStock === 0}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                className="cart2-quantity-input"
                                value={item.quantity}
                                min="1"
                                onChange={(e) => {
                                  const newQty = parseInt(e.target.value) || 1;
                                  onQuantityChange(item, newQty);
                                }}
                                disabled={item.productAvailable === false || item.sizeAvailable === false || item.availableStock === 0}
                              />
                              <button
                                className="cart2-quantity-btn"
                                onClick={() => onQuantityChange(item, item.quantity + 1)}
                                disabled={item.productAvailable === false || item.sizeAvailable === false || item.availableStock === 0}
                              >
                                +
                              </button>
                            </div>
                            {(item.productAvailable === false || item.sizeAvailable === false) && (
                              <div style={{ color: '#ff424f', fontSize: '11px', marginTop: '4px' }}>
                                Sản phẩm ngừng kinh doanh
                              </div>
                            )}
                            {item.productAvailable !== false && item.sizeAvailable !== false && item.availableStock < item.quantity && (
                              <div style={{ color: '#ffad0d', fontSize: '11px', marginTop: '4px' }}>
                                Chỉ còn {item.availableStock} sp
                              </div>
                            )}
                          </div>
                          <div className="cart2-amount">
                            {formatVND((item.unitPrice || item.price || 0) * item.quantity)}
                          </div>
                          <div className="cart2-actions">
                            <a
                              className="cart2-action-link"
                              onClick={() => onRemove(item.id, pid)}
                            >
                              {t('cart2.delete')}
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

              <div className="cart2-voucher-section">
                <span style={{ fontWeight: 600 }}>{t('cart2.shopeeVoucher')}</span>
                <Link to="#" className="cart2-voucher-link">
                  {t('cart2.selectOrEnterCode')}
                </Link>
              </div>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart2-bottom">
            <div className="cart2-bottom-content">
              <div className="cart2-bottom-left">
                <input
                  type="checkbox"
                  className="cart2-checkbox"
                  checked={allChecked}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
                <span style={{ fontSize: '14px' }}>
                  {t('cart2.selectAll')} ({items.length})
                </span>
              </div>
              <div className="cart2-bottom-right">
                <div className="cart2-total">
                  <div className="cart2-total-label">
                    {t('cart2.total')} ({selectedQuantity} {t('cart2.products')}):
                  </div>
                  <div className="cart2-total-amount">
                    {formatVND(selectedSubtotal)}
                  </div>
                </div>
                <button
                  className="cart2-buy-btn"
                  onClick={onCheckout}
                  disabled={selected.size === 0}
                  title={selected.size === 0 ? t('checkout.pleaseSelectAtLeastOneItem') : ''}
                >
                  {t('cart2.buyNow')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

