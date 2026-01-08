import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Header from "../../components/client/Header.jsx";
import { Cart } from "../../components/client/cart/Cart.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Swal from "sweetalert2";
import Cookies from "js-cookie";
import {
  getCart,
  getAllAddress,
  getShopOwnerByUserId
} from "../../api/user.js";
import {
  removeCartItem,
  updateCartItemQuantity,
  fetchProductById
} from "../../api/product.js";
import { fetchImageById } from "../../api/image.js";

export default function CartPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const token = Cookies.get("accessToken");

  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState({});
  const [productNames, setProductNames] = useState({});
  const [shopOwners, setShopOwners] = useState({});
  const [shopOwnerIds, setShopOwnerIds] = useState({}); // Store shopOwnerId for voucher validation
  const [selected, setSelected] = useState(() => new Set());
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updatingQuantities, setUpdatingQuantities] = useState(new Set());
  const debounceTimeouts = useRef({});
  const lastClickTime = useRef({});

  // fetch cart
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const data = await getCart();
        setCart(data);
        // auto-select if navigated with state
        if (location.state?.selectProduct) {
          const { productId, sizeId } = location.state.selectProduct;
          const key = `${productId}:${sizeId || "no-size"}`;
          setSelected(new Set([key]));
          window.history.replaceState({}, document.title);
        }
      } catch (e) {
        setError(t("product.noProductsYet"));
        setCart({ items: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [token, navigate, location.state, t]);

  // fetch addresses
  const refreshAddresses = async () => {
    setAddressLoading(true);
    try {
      const data = await getAllAddress();
      setAddresses(data);
      const def = data.find((a) => a.isDefault);
      if (def) setSelectedAddressId(def.id);
      else if (data.length > 0) setSelectedAddressId(data[0].id);
    } catch (e) {
      setError(t("address.loadFailed"));
    } finally {
      setAddressLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    refreshAddresses();
  }, [token]);

  // preload images, names, and shop owners
  useEffect(() => {
    let revoked = false;
    const blobUrls = [];
    (async () => {
      if (!Array.isArray(cart?.items) || cart.items.length === 0) return;
      const urls = {};
      const names = {};
      const owners = {};
      const ownerIds = {}; // Store shopOwnerId
      const productCache = new Map();
      const shopOwnerCache = new Map();

      await Promise.all(
        cart.items.map(async (item) => {
          const pid = item.productId ?? item.id;
          if (!pid) return;
          let imageId = item.imageId;
          let shopOwnerId = null;

          // ALWAYS fetch product info to get userId (shop owner)
          try {
            let prod = productCache.get(pid);
            if (!prod) {
              prod = await fetchProductById(pid);
              productCache.set(pid, prod);
            }
            if (!imageId) imageId = prod?.data?.imageId ?? null;
            if (prod?.data?.name) names[pid] = prod.data.name;
            // Get shop owner userId from product - this is the key!
            shopOwnerId = prod?.data?.userId;
          } catch {
            // ignore
          }

          if (item.productName) names[pid] = item.productName;

          // Fetch shop owner info using userId from product
          if (shopOwnerId) {
            try {
              let shopOwner = shopOwnerCache.get(shopOwnerId);
              if (!shopOwner) {
                shopOwner = await getShopOwnerByUserId(shopOwnerId);
                shopOwnerCache.set(shopOwnerId, shopOwner);
              }
              // Use shopName or ownerName
              owners[pid] = shopOwner?.shopName || shopOwner?.ownerName || 'Unknown Shop';
              // Store shopOwnerId (userId from product)
              ownerIds[pid] = shopOwnerId;
            } catch {
              owners[pid] = 'Unknown Shop';
            }
          } else {
            owners[pid] = item.shopOwnerName || item.shopName || 'Unknown Shop';
          }

          // Fetch image
          if (imageId) {
            try {
              const res = await fetchImageById(imageId);
              const blob = new Blob([res.data], { type: res.headers["content-type"] });
              const url = URL.createObjectURL(blob);
              blobUrls.push(url);
              urls[pid] = url;
            } catch {
              urls[pid] = null;
            }
          } else {
            urls[pid] = null;
          }
        })
      );

      if (!revoked) {
        setImageUrls(urls);
        setProductNames((prev) => ({ ...prev, ...names }));
        setShopOwners((prev) => ({ ...prev, ...owners }));
        setShopOwnerIds((prev) => ({ ...prev, ...ownerIds }));
      }
    })();
    return () => {
      revoked = true;
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [cart]);

  // Clean up selection when items become unavailable
  useEffect(() => {
    if (!cart?.items) return;

    setSelected((prev) => {
      const next = new Set(prev);
      let changed = false;

      cart.items.forEach((item) => {
        const pid = item.productId ?? item.id;
        const key = `${pid}:${item.sizeId || "no-size"}`;

        // If selected but unavailable/out of stock -> deselect
        if (next.has(key)) {
          const isUnavailable = !item.productAvailable || !item.sizeAvailable || item.availableStock === 0 || item.quantity > item.availableStock;
          if (isUnavailable || !item.productAvailable) { // Double check availability flags
            next.delete(key);
            changed = true;
          }
        }
      });

      return changed ? next : prev;
    });
  }, [cart]);

  const items = cart?.items ?? [];

  const allKeys = useMemo(
    () =>
      items.map((it) => {
        const pid = it.productId ?? it.id;
        const sid = it.sizeId;
        return `${pid}:${sid || "no-size"}`;
      }),
    [items]
  );

  const selectedItems = useMemo(
    () =>
      items.filter((it) => {
        const pid = it.productId ?? it.id;
        const sid = it.sizeId;
        const key = `${pid}:${sid || "no-size"}`;
        return selected.has(key);
      }),
    [items, selected]
  );

  const selectedQuantity = selectedItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const selectedSubtotal = selectedItems.reduce((sum, it) => {
    const line =
      it.totalPrice != null
        ? Number(it.totalPrice)
        : Number(it.unitPrice || it.price || 0) * Number(it.quantity || 0);
    return sum + line;
  }, 0);

  const allChecked = allKeys.length > 0 && allKeys.every((key) => selected.has(key));

  const handleToggle = (key, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleToggleAll = (checked) => {
    if (checked) setSelected(new Set(allKeys));
    else setSelected(new Set());
  };

  const handleRemove = async (cartItemId, productId) => {
    const name = productNames[productId] || "item";
    const res = await Swal.fire({
      title: t("cart.remove.confirm"),
      text: t("cart.remove.text", { name }),
      icon: "warning",
      showCancelButton: true,
    });
    if (!res.isConfirmed) return;
    try {
      await removeCartItem(cartItemId);
      const data = await getCart();
      setCart(data);
      setSelected((prev) => {
        const next = new Set(prev);
        const keyPrefix = `${productId}:`;
        [...prev].forEach((k) => {
          if (k.startsWith(keyPrefix)) next.delete(k);
        });
        return next;
      });
    } catch (e) {
      Swal.fire("Error", t("cart.remove.failed"), "error");
    }
  };

  const handleQuantityChange = useCallback(
    async (item, newQuantity) => {
      const productId = item.productId || item.id;
      const sizeId = item.sizeId;
      if (newQuantity < 1) return;
      const itemKey = `${productId}:${sizeId || "no-size"}`;
      const now = Date.now();
      if (lastClickTime.current[itemKey] && now - lastClickTime.current[itemKey] < 80) return;
      lastClickTime.current[itemKey] = now;

      if (debounceTimeouts.current[itemKey]) {
        clearTimeout(debounceTimeouts.current[itemKey]);
      }
      setUpdatingQuantities((prev) => new Set(prev).add(itemKey));

      // optimistic
      setCart((prev) => {
        if (!prev?.items) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            (it.productId || it.id) === productId && it.sizeId === sizeId
              ? { ...it, quantity: newQuantity, totalPrice: (it.unitPrice || it.price) * newQuantity }
              : it
          ),
        };
      });

      debounceTimeouts.current[itemKey] = setTimeout(async () => {
        try {
          await updateCartItemQuantity({
            productId,
            sizeId: sizeId || undefined,
            quantity: newQuantity,
          });
          const data = await getCart();
          setCart(data);
        } catch (e) {
          // Check for INSUFFICIENT_STOCK error from backend
          const errorMessage = e?.response?.data?.message || e?.message || '';
          if (errorMessage.includes('INSUFFICIENT_STOCK')) {
            const availableStock = parseInt(errorMessage.split(':')[1]) || 0;
            Swal.fire({
              icon: 'warning',
              title: t('cart.quantity.onlyAvailable', { count: availableStock }),
              text: t('cart.checkout.reduceQuantity'),
              confirmButtonColor: '#ee4d2d'
            });
            // Reset to max available quantity
            setCart((prev) => {
              if (!prev?.items) return prev;
              return {
                ...prev,
                items: prev.items.map((it) =>
                  (it.productId || it.id) === productId && it.sizeId === sizeId
                    ? { ...it, quantity: availableStock, totalPrice: (it.unitPrice || it.price) * availableStock }
                    : it
                ),
              };
            });
          } else {
            Swal.fire("Error", t("cart.quantity.updateFailed"), "error");
          }
          // Refresh cart from server to get correct state
          const data = await getCart();
          setCart(data);
        } finally {
          setUpdatingQuantities((prev) => {
            const next = new Set(prev);
            next.delete(itemKey);
            return next;
          });
          delete debounceTimeouts.current[itemKey];
        }
      }, 400);
    },
    [t]
  );

  const handleCheckout = () => {
    if (selected.size === 0) {
      Swal.fire("Thông báo", t("cart.checkout.selectAtLeastOne"), "info");
      return;
    }
    // Add shopOwnerName and shopOwnerId to each selected item
    const itemsWithShopOwner = selectedItems.map((item) => {
      const pid = item.productId ?? item.id;
      return {
        ...item,
        shopOwnerName: shopOwners[pid] || 'Unknown Shop',
        shopOwnerId: shopOwnerIds[pid] || null, // Add shopOwnerId for voucher validation
        productName: productNames[pid] || item.productName || pid,
      };
    });
    console.log("CartPage Navigate Payload:", itemsWithShopOwner);
    navigate("/checkout", {
      state: {
        selectedItems: itemsWithShopOwner,
        subtotal: selectedSubtotal,
        selectedQuantity,
        selectedAddressId,
        addresses,
        imageUrls,
        productNames,
      },
    });
  };

  return (
    <div className="wrapper">
      <Header />
      <main className="main-content" style={{ paddingTop: 0 }}>
        <Cart
          items={items}
          imageUrls={imageUrls}
          productNames={productNames}
          shopOwners={shopOwners}
          selected={selected}
          onToggle={handleToggle}
          onToggleAll={handleToggleAll}
          onRemove={handleRemove}
          onQuantityChange={handleQuantityChange}
          onCheckout={handleCheckout}
          allChecked={allChecked}
          selectedQuantity={selectedQuantity}
          selectedSubtotal={selectedSubtotal}
          savedAmount={0}
        />
      </main>
    </div>
  );
}

