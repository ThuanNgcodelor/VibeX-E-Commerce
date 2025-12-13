import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Cookies from "js-cookie";
import { getCart, getAllAddress } from "../../../api/user.js";
import { fetchImageById } from "../../../api/image.js";
import { fetchProductById, removeCartItem, updateCartItemQuantity } from "../../../api/product.js";
import { createOrder, calculateShippingFee } from "../../../api/order.js";
import { createVnpayPayment } from "../../../api/payment.js";
import Swal from "sweetalert2";
import { CartItemList } from "./CartItemList";
import { CheckoutSection } from "./CheckoutSection";

export function Cart() {
  const { t } = useTranslation();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [imageUrls, setImageUrls] = useState({});
  const [selected, setSelected] = useState(() => new Set());
  const [productNames, setProductNames] = useState({});

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [modalSelectedAddressId, setModalSelectedAddressId] = useState(null);

  const [orderLoading, setOrderLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

  const [, setOrderSuccess] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderReceipt, setOrderReceipt] = useState(null);

  const [updatingQuantities, setUpdatingQuantities] = useState(new Set());
  const [shippingFee, setShippingFee] = useState(null);
  const [calculatingShippingFee, setCalculatingShippingFee] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const debounceTimeouts = useRef({});
  const lastClickTime = useRef({});

  const navigate = useNavigate();
  const location = useLocation();
  const token = Cookies.get("accessToken");

  const toast = (icon, title) =>
    Swal.fire({
      toast: true,
      position: "top-end",
      icon,
      title,
      showConfirmButton: false,
      timer: 2200,
      timerProgressBar: true,
    });

  const formatCurrency = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(Number(n || 0));

  const refreshAddresses = async () => {
    setAddressLoading(true);
    try {
      const data = await getAllAddress();
      setAddresses(data);
      const def = data.find((a) => a.isDefault);
      if (def) setSelectedAddressId(def.id);
      else if (data.length > 0) setSelectedAddressId(data[0].id);
    } catch (e) {
      console.error("Failed to refresh addresses:", e);
      setError(t('address.loadFailed'));
      Swal.fire({
        icon: "error",
        title: t('address.loadFailed'),
        text: t('address.tryAgain'),
      });
    } finally {
      setAddressLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      Object.values(debounceTimeouts.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      lastClickTime.current = {};
    };
  }, []);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const data = await getCart();
        console.log("Cart loaded - items:", JSON.stringify(data?.items, null, 2));
        setCart(data);
        
        // Auto-select product if coming from Buy Now
        if (location.state?.selectProduct) {
          const { productId, sizeId } = location.state.selectProduct;
          const key = `${productId}:${sizeId || 'no-size'}`;
          // Wait a bit for items to be processed
          setTimeout(() => {
            setSelected(new Set([key]));
          }, 100);
          // Clear the state to prevent re-selection on refresh
          window.history.replaceState({}, document.title);
        }
      } catch {
        setError(t('product.noProductsYet'));
        setCart({ items: [] });
        Swal.fire({
          icon: "error",
          title: t('product.noProductsYet'),
          text: t('product.pleaseBuy'),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [token, navigate, location.state]);

  useEffect(() => {
    if (!token) return;
    refreshAddresses();
  }, [token]);

  useEffect(() => {
    const onFocus = () => token && refreshAddresses();
    const onVisible = () => !document.hidden && token && refreshAddresses();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  useEffect(() => {
    let revoked = false;
    const blobUrls = [];

    (async () => {
      if (!Array.isArray(cart?.items) || cart.items.length === 0) return;

      const urls = {};
      const names = {};
      const productCache = new Map();

      await Promise.all(
        cart.items.map(async (item) => {
          const pid = item.productId ?? item.id;
          if (!pid) return;

          let imageId = item.imageId;
          if (!imageId) {
            try {
              let prod = productCache.get(pid);
              if (!prod) {
                prod = await fetchProductById(pid);
                productCache.set(pid, prod);
              }
              imageId = prod?.data?.imageId ?? null;
              if (prod?.data?.name) names[pid] = prod.data.name;
            } catch {
              imageId = null;
            }
          }

          if (imageId) {
            try {
              const res = await fetchImageById(imageId);
              const blob = new Blob([res.data], {
                type: res.headers["content-type"],
              });
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
      }
    })();

    return () => {
      revoked = true;
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [cart]);

  const items = cart?.items ?? [];
  const totalItems = items.length;

  const allKeys = useMemo(
    () => items.map((it) => {
      const pid = it.productId ?? it.id;
      const sid = it.sizeId;
      return `${pid}:${sid || 'no-size'}`;
    }),
    [items]
  );

  const selectedItems = useMemo(
    () => items.filter((it) => {
      const pid = it.productId ?? it.id;
      const sid = it.sizeId;
      const key = `${pid}:${sid || 'no-size'}`;
      return selected.has(key);
    }),
    [items, selected]
  );

  const selectedQuantity = selectedItems.reduce(
    (sum, it) => sum + Number(it.quantity || 0),
    0
  );

  const selectedSubtotal = selectedItems.reduce((sum, it) => {
    const line =
      it.totalPrice != null
        ? Number(it.totalPrice)
        : Number(it.unitPrice || it.price || 0) * Number(it.quantity || 0);
    return sum + line;
  }, 0);

  const allChecked =
    allKeys.length > 0 && allKeys.every((key) => selected.has(key));
  
  // Calculate shipping fee when address or selected items change
  useEffect(() => {
    const calculateFee = async () => {
      if (!selectedAddressId || selectedItems.length === 0) {
        setShippingFee(null);
        return;
      }
      
      setCalculatingShippingFee(true);
      try {
        const result = await calculateShippingFee(selectedAddressId, selectedItems);
        if (result && result.shippingFee) {
          setShippingFee(result.shippingFee);
        } else {
          setShippingFee(null);
        }
      } catch (error) {
        console.error("Failed to calculate shipping fee:", error);
        setShippingFee(null);
      } finally {
        setCalculatingShippingFee(false);
      }
    };
    
    // Debounce calculation
    const timeoutId = setTimeout(calculateFee, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedAddressId, selectedItems]);

  const toggleOne = (key, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleAll = (checked) => {
    if (checked) setSelected(new Set(allKeys));
    else setSelected(new Set());
  };

  const handleRemove = async (cartItemId, productId) => {
    const item = items.find((i) => i.id === cartItemId);
    const name =
      productNames[productId] ||
      item?.productName ||
      "this item";

    const res = await Swal.fire({
      title: t('cart.remove.confirm'),
      text: t('cart.remove.text', { name }),
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: t('common.remove'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
    });
    if (!res.isConfirmed) return;

    try {
      Swal.fire({
        title: t('cart.remove.removing'),
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const ok = await removeCartItem(cartItemId);
      if (ok) {
        const data = await getCart();
        setCart(data);
        setSelected((prev) => {
          const next = new Set(prev);
          // Remove all keys with this productId
          const keysToRemove = [];
          prev.forEach(key => {
            if (key.startsWith(`${productId}:`)) {
              keysToRemove.push(key);
            }
          });
          keysToRemove.forEach(key => next.delete(key));
          return next;
        });
        Swal.close();
        toast("success", t('cart.remove.success'));
      } else {
        Swal.close();
        Swal.fire({
          icon: "error",
          title: t('cart.remove.failed'),
          text: t('cart.remove.tryAgain'),
        });
      }
    } catch (e) {
      Swal.close();
      console.error("Remove item failed:", e);
      Swal.fire({
        icon: "error",
        title: t('cart.remove.failed'),
        text: e?.response?.data?.message || t('cart.remove.tryAgain'),
      });
    }
  };

  const handleQuantityChange = useCallback(async (item, newQuantity) => {
    const productId = item.productId || item.id;
    const sizeId = item.sizeId;

    if (newQuantity < 1) {
      toast("warning", t('cart.quantity.mustBeAtLeast1'));
      return;
    }

    // Check stock limit
    const maxStock = item.stock !== undefined ? item.stock : Infinity;
    if (newQuantity > maxStock) {
      toast("warning", t('cart.quantity.onlyAvailable', { count: maxStock }));
      return;
    }

    const itemKey = `${productId}:${sizeId || 'no-size'}`;

    const now = Date.now();
    if (lastClickTime.current[itemKey] && (now - lastClickTime.current[itemKey]) < 100) {
      return;
    }
    lastClickTime.current[itemKey] = now;

    if (debounceTimeouts.current[itemKey]) {
      clearTimeout(debounceTimeouts.current[itemKey]);
      setUpdatingQuantities(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemKey);
        return newSet;
      });
    }

    setUpdatingQuantities(prev => new Set(prev).add(itemKey));

    setCart(prevCart => {
      if (!prevCart?.items) return prevCart;
      
      return {
        ...prevCart,
        items: prevCart.items.map(cartItem => {
          if ((cartItem.productId || cartItem.id) === productId && cartItem.sizeId === sizeId) {
            return {
              ...cartItem,
              quantity: newQuantity,
              totalPrice: cartItem.price * newQuantity
            };
          }
          return cartItem;
        })
      };
    });

    debounceTimeouts.current[itemKey] = setTimeout(async () => {
      try {
        const requestData = {
          productId: productId,
          sizeId: sizeId || undefined,
          quantity: newQuantity
        };
        
        console.log("Sending request:", requestData);
        
        await updateCartItemQuantity(requestData);
        
        const data = await getCart();
        setCart(data);
        toast("success", t('cart.quantity.updated'));
      } catch (error) {
        console.error("Failed to update quantity:", error);
        
        try {
          const data = await getCart();
          setCart(data);
        } catch (refreshError) {
          console.error("Failed to refresh cart:", refreshError);
        }
        
        let errorMessage = t('cart.quantity.updateFailed');
        if (error?.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (error?.response?.status) {
          errorMessage = `Server error (${error.response.status})`;
        }
        
        toast("error", errorMessage);
        Swal.fire({
          icon: "error",
          title: t('cart.quantity.updateFailed'),
          text: errorMessage,
        });
      } finally {
        setUpdatingQuantities(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemKey);
          return newSet;
        });

        delete debounceTimeouts.current[itemKey];
      }
    }, 500);
  }, [cart, t]);

  const handleCheckout = async (e) => {
    e?.preventDefault?.();
    if (orderLoading) return;

    if (selected.size === 0) {
      await Swal.fire({
        icon: "warning",
        title: t('cart.checkout.noItemsSelected'),
        text: t('cart.checkout.selectAtLeastOne'),
        confirmButtonText: t('common.ok'),
      });
      return;
    }
    if (addresses.length === 0) {
      const go = await Swal.fire({
        icon: "info",
        title: t('cart.checkout.noAddressFound'),
        text: t('cart.checkout.needAddress'),
        showCancelButton: true,
        confirmButtonText: t('cart.checkout.addAddress'),
        cancelButtonText: t('common.cancel'),
      });
      if (go.isConfirmed) navigate("/information/address");
      return;
    }
    if (!selectedAddressId) {
      await Swal.fire({
        icon: "info",
        title: t('cart.checkout.selectDeliveryAddress'),
        text: t('cart.checkout.chooseAddress'),
        confirmButtonText: t('cart.checkout.chooseNow'),
      });
      setModalSelectedAddressId(null);
      setShowAddressModal(true);
      return;
    }

    setOrderLoading(true);
    try {
      const orderData = {
        selectedItems: selectedItems.map((it) => ({
          productId: it.productId || it.id,
          sizeId: it.sizeId, 
          quantity: it.quantity,
          unitPrice: it.unitPrice || it.price,
        })),
        addressId: selectedAddressId,
        paymentMethod: paymentMethod || "COD",
      };

      Swal.fire({
        title: t('cart.checkout.creatingOrder'),
        text: t('cart.checkout.pleaseWait'),
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      // If VNPay, create payment first (order will be created after payment success)
      if (paymentMethod === "VNPAY" || paymentMethod === "CARD") {
        try {
          const totalWithShipping = selectedSubtotal + (shippingFee || 0);
          
          // Get userId from cart
          const userId = cart?.userId;
          if (!userId) {
            throw new Error("Cannot get user ID from cart");
          }

          // Create payment with order data (order will be created after payment success)
          const payPayload = {
            amount: Math.max(1, Math.round(totalWithShipping)),
            orderInfo: "Thanh toan don hang",
            userId: userId,
            addressId: selectedAddressId,
            orderDataJson: JSON.stringify({
              userId: userId,
              addressId: selectedAddressId,
              selectedItems: selectedItems.map((it) => ({
                productId: it.productId || it.id,
                sizeId: it.sizeId,
                quantity: it.quantity,
                unitPrice: it.unitPrice || it.price,
              })),
            }),
          };
          
          const payRes = await createVnpayPayment(payPayload);
          Swal.close();
          
          if (payRes?.paymentUrl) {
            // Redirect to VNPay - order will be created after payment success
            window.location.href = payRes.paymentUrl;
            return;
          } else {
            throw new Error("No payment URL returned");
          }
        } catch (payErr) {
          console.error("Create VNPay payment failed:", payErr);
          Swal.close();
          await Swal.fire({
            icon: "error",
            title: t('payment.paymentError.title'),
            text: payErr?.response?.data?.message || payErr?.message || t('payment.paymentError.text'),
            confirmButtonText: t('common.ok'),
          });
          return;
        }
      }

      // COD flow - use async Kafka
      const result = await createOrder(orderData);
      Swal.close();

      // Optional: keep receipt in state if needed elsewhere
      setOrderReceipt(result);
      setOrderSuccess(true);
      setShowSuccessModal(false); // skip success modal

      const data = await getCart();
      setCart(data);
      setSelected(new Set());
      toast("success", t('cart.checkout.orderCreated'));

      navigate("/information/orders");
      } catch (err) {
        console.error("Failed to create order:", err);
        Swal.close();
        
        if (err.type === 'INSUFFICIENT_STOCK') {
          const details = err.details;
          let stockMessage = err.message;
          
          if (details && details.available && details.requested) {
            stockMessage = `${t('cart.checkout.insufficientStock')}. ${t('cart.checkout.available')}: ${details.available}, ${t('cart.checkout.requested')}: ${details.requested}`;
          }
          
          await Swal.fire({
            icon: "warning",
            title: t('cart.checkout.insufficientStock'),
            html: `
              <p>${stockMessage}</p>
              <p class="text-muted">${t('cart.checkout.reduceQuantity')}</p>
            `,
            confirmButtonText: t('common.ok'),
            confirmButtonColor: "#ff6b35"
          });
        } else if (err.type === 'ADDRESS_NOT_FOUND') {
          await Swal.fire({
            icon: "error",
            title: t('cart.checkout.invalidAddress'),
            text: t('cart.checkout.selectValidAddress'),
            confirmButtonText: t('cart.checkout.selectAddress'),
            confirmButtonColor: "#dc3545"
          }).then((result) => {
            if (result.isConfirmed) {
              setShowAddressModal(true);
            }
          });
        } else if (err.type === 'CART_EMPTY') {
          await Swal.fire({
            icon: "info",
            title: t('cart.checkout.emptyCart'),
            text: t('cart.checkout.cartEmpty'),
            confirmButtonText: t('cart.checkout.goShopping'),
            confirmButtonColor: "#007bff"
          }).then((result) => {
            if (result.isConfirmed) {
              navigate("/shop");
            }
          });
        } else {
          await Swal.fire({
            icon: "error",
            title: t('cart.checkout.checkoutFailed'),
            html: `
              <p>${err.message || t('cart.checkout.errorOccurred')}</p>
              <p class="text-muted">${t('cart.checkout.contactSupport')}</p>
            `,
            confirmButtonText: t('common.tryAgain'),
            confirmButtonColor: "#dc3545"
          });
        }
      } finally {
      setOrderLoading(false);
    }
  };

  const handleOpenAddressModal = () => {
    setModalSelectedAddressId(selectedAddressId);
    setShowAddressModal(true);
  };

  const handleAddressSelect = (id) => setModalSelectedAddressId(id);

  const handleConfirmSelection = () => {
    if (modalSelectedAddressId) {
      setSelectedAddressId(modalSelectedAddressId);
      setShowAddressModal(false);
      toast("success", t('cart.address.selected'));
    }
  };

  useEffect(() => {
    if (!showAddressModal) setModalSelectedAddressId(null);
  }, [showAddressModal]);

  const isEmpty = !cart || !Array.isArray(cart.items) || cart.items.length === 0;

  const pageContent = (() => {
    if (loading && !showSuccessModal) {
      return (
        <div className="container cart">
          <p>{t('common.loading')}</p>
        </div>
      );
    }

    if (error && !showSuccessModal) {
      return (
        <div className="container cart">
          <p>{error}</p>
        </div>
      );
    }

    return (
      <>
        <style>{`
          .cart-table-wrap { overflow-x: hidden; }
          .cart-table table { width: 100% !important; table-layout: fixed; }
          .cart-table table th, .cart-table table td { word-wrap: break-word; overflow-wrap: break-word; }
          .cart-table table th:nth-child(1), .cart-table table td:nth-child(1) { width: 50px; }
          .cart-table table th:nth-child(2), .cart-table table td:nth-child(2) { width: 80px; }
          .cart-table table th:nth-child(3), .cart-table table td:nth-child(3) { width: 200px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .cart-table table th:nth-child(4), .cart-table table td:nth-child(4) { width: 100px; }
          .cart-table table th:nth-child(5), .cart-table table td:nth-child(5) { width: 100px; }
          .cart-table table th:nth-child(6), .cart-table table td:nth-child(6) { width: 120px; }
          .cart-table table th:nth-child(7), .cart-table table td:nth-child(7) { width: 50px; }
          .modal.show { display: block !important; }
          .modal-backdrop { z-index: 10000 !important; }
          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(40, 167, 69, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
          }
        `}</style>

        <section
          className="page-header-area"
          style={{ backgroundColor: "#f8eefa" }}
        >
          <div className="container">
            <div className="row">
              <div className="col-sm-8">
                <div className="page-header-content">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <Link to="/">David-Nguyen</Link>
                    </li>
                  </ol>
                  <h2 className="page-header-title">{t('cart.title')}</h2>
                  <div className="text-muted">{totalItems} {t('cart.items')}</div>
                </div>
              </div>
              <div className="col-sm-4 d-sm-flex justify-content-end align-items-end">
                <h5 className="showing-pagination-results"> / {t('cart.cartPage')}</h5>
              </div>
            </div>
          </div>
        </section>

        <section className="cart-page-area section-space">
          <div className="container">
            <div className="row">
              {isEmpty ? (
                <div className="col-lg-12 text-center">
                  <div style={{ 
                    padding: "40px 20px",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "10px",
                    margin: "0 0 80px 0"
                  }}>
                    <i className="fa fa-shopping-cart" style={{ 
                      fontSize: "80px", 
                      color: "#dee2e6",
                      marginBottom: "20px" 
                    }}></i>
                    <h4 style={{ color: "#6c757d", marginBottom: "10px" }}>
                      {t('cart.empty.title')}
                    </h4>
                    <p style={{ color: "#adb5bd", marginBottom: "30px" }}>
                      {t('cart.empty.description')}
                    </p>
                    <Link to="/shop" className="btn btn-primary">
                      <i className="fa fa-shopping-bag me-2"></i>
                      {t('cart.empty.continueShopping')}
                    </Link>
                  </div>
                </div>
              ) : (
                <CartItemList
                  items={items}
                  imageUrls={imageUrls}
                  productNames={productNames}
                  selected={selected}
                  updatingQuantities={updatingQuantities}
                  onToggle={toggleOne}
                  onToggleAll={toggleAll}
                  onRemove={handleRemove}
                  onQuantityChange={handleQuantityChange}
                  formatCurrency={formatCurrency}
                  allChecked={allChecked}
                  onBackToShop={() => {}}
                />
              )}

              <div className="col-lg-4" />
            </div>

            <CheckoutSection
              cart={cart}
              addresses={addresses}
              selectedAddressId={selectedAddressId}
              addressLoading={addressLoading}
              selectedItems={selectedItems}
              selectedQuantity={selectedQuantity}
              selectedSubtotal={selectedSubtotal}
              shippingFee={shippingFee}
              calculatingShippingFee={calculatingShippingFee}
              selected={selected}
              allChecked={allChecked}
              orderLoading={orderLoading}
              formatCurrency={formatCurrency}
              onToggleAll={toggleAll}
              onOpenAddressModal={handleOpenAddressModal}
              onRefreshAddresses={refreshAddresses}
              onCheckout={handleCheckout}
              navigate={navigate}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
            />
          </div>
        </section>

        {showAddressModal &&
          ReactDOM.createPortal(
            <div
              className="modal show d-block"
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                zIndex: 10000,
              }}
              aria-modal="true"
              role="dialog"
            >
              <div className="modal-dialog modal-lg" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{t('cart.address.selectDeliveryAddress')}</h5>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={refreshAddresses}
                        disabled={addressLoading}
                        title={t('cart.address.refresh')}
                      >
                        <i
                          className={`fa fa-refresh ${
                            addressLoading ? "fa-spin" : ""
                          }`}
                        ></i>
                      </button>
                      <button
                        type="button"
                        className="btn-close"
                        onClick={() => setShowAddressModal(false)}
                        aria-label="Close"
                      />
                    </div>
                  </div>

                  <div className="modal-body">
                    {addresses.length === 0 ? (
                      <div className="text-center">
                        <p className="text-muted mb-3">
                          {t('cart.address.noAddressesFound')}
                        </p>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => {
                            setShowAddressModal(false);
                            navigate("/information/address");
                          }}
                        >
                          {t('cart.address.addAddress')}
                        </button>
                      </div>
                    ) : (
                      <div className="row">
                        {addresses.map((a) => (
                          <div key={a.id} className="col-md-6 mb-3">
                            <div
                              className={`card h-100 ${
                                modalSelectedAddressId === a.id
                                  ? "border-primary"
                                  : ""
                              }`}
                              onClick={() => handleAddressSelect(a.id)}
                              style={{ cursor: "pointer" }}
                            >
                              <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start">
                                  <h6 className="card-title">
                                    {a.addressName || t('cart.address.unnamedAddress')}
                                  </h6>
                                  {a.isDefault && (
                                    <span className="badge bg-primary">
                                      {t('cart.address.default')}
                                    </span>
                                  )}
                                </div>
                                <p className="card-text">
                                  <strong>{a.recipientName}</strong>
                                  <br />
                                  {a.streetAddress}
                                  <br />
                                  {a.province}
                                  <br />
                                  Phone: {a.recipientPhone}
                                </p>
                                {modalSelectedAddressId === a.id && (
                                  <div className="text-primary">
                                    <i className="fa fa-check-circle"></i>{" "}
                                    {t('cart.address.selected')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowAddressModal(false)}
                    >
                      {t('common.cancel')}
                    </button>
                    {addresses.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConfirmSelection}
                        disabled={!modalSelectedAddressId}
                      >
                        {t('cart.address.confirmSelection')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  })();

  return (
    <>
      {pageContent}

      {showSuccessModal &&
        ReactDOM.createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-success-title"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "20px",
                padding: "40px",
                maxWidth: "500px",
                width: "90%",
                boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <div style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    backgroundColor: "#28a745",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                    animation: "pulse 2s infinite",
                  }}
                >
                  <i
                    className="fa fa-check"
                    style={{ color: "white", fontSize: "40px" }}
                  ></i>
                </div>
              </div>

              <h3
                id="order-success-title"
                style={{
                  color: "#28a745",
                  fontWeight: "bold",
                  marginBottom: "15px",
                }}
              >
                {t('cart.orderSuccess.title')}
              </h3>

              {orderReceipt && (
                <div
                  style={{ marginBottom: 16, color: "#444", textAlign: "left" }}
                >
                  <div>
                    <strong>{t('cart.orderSuccess.orderId')}:</strong>{" "}
                    {orderReceipt.id ?? orderReceipt.orderId ?? "-"}
                  </div>
                  {"code" in orderReceipt || "orderCode" in orderReceipt ? (
                    <div>
                      <strong>{t('cart.orderSuccess.orderCode')}:</strong>{" "}
                      {orderReceipt.code ?? orderReceipt.orderCode}
                    </div>
                  ) : null}
                  <div>
                    <strong>{t('cart.orderSuccess.status')}:</strong> {orderReceipt.status ?? "CREATED"}
                  </div>
                  {"createdAt" in orderReceipt ? (
                    <div>
                      <strong>{t('cart.orderSuccess.createdAt')}:</strong>{" "}
                      {String(orderReceipt.createdAt)}
                    </div>
                  ) : null}
                  {"eta" in orderReceipt ? (
                    <div>
                      <strong>{t('cart.orderSuccess.eta')}:</strong> {String(orderReceipt.eta)}
                    </div>
                  ) : null}
                </div>
              )}

              <div
                style={{
                  backgroundColor: "#f8f9fa",
                  padding: "15px",
                  borderRadius: "10px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-around" }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#007bff",
                        fontSize: "18px",
                      }}
                    >
                      {orderReceipt?.items?.length ??
                        orderReceipt?.selectedItems?.length ??
                        0}
                    </div>
                    <small style={{ color: "#666" }}>{t('cart.orderSuccess.itemsOrdered')}</small>
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#007bff",
                        fontSize: "18px",
                      }}
                    >
                      {formatCurrency(orderReceipt?.totalAmount ?? 0)}
                    </div>
                    <small style={{ color: "#666" }}>{t('cart.orderSuccess.totalAmount')}</small>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate("/information/orders")}
                >
                  <i className="fa fa-list-alt me-2"></i>
                  {t('cart.orderSuccess.viewOrders')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
