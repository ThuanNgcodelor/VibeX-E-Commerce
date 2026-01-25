import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactDOM from "react-dom";
import Cookies from "js-cookie";
import imgFallback from "../../../assets/images/shop/6.png";
import { getAllAddress, getUser, getWalletBalance } from "../../../api/user.js";
import { calculateShippingFee, createOrder, reserveStock, previewCheckout } from "../../../api/order.js";
import { createVnpayPayment, createMomoPayment } from "../../../api/payment.js";
import { validateVoucher } from "../../../api/voucher.js";
import { trackPurchase } from "../../../api/tracking";
import Swal from "sweetalert2";
import {
  MdLocationOn,
  MdChat,
  MdLocalActivity,
  MdLocalShipping,
  MdMonetizationOn,
  MdCheckCircle,
  MdCardGiftcard,
  MdAccountBalanceWallet,
  MdPayments,
  MdShoppingBag,
  MdStars
} from "react-icons/md";
import { HiOutlineTicket } from "react-icons/hi";

const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

export function CheckoutPage({
  selectedItems: selectedItemsProp = [],
  imageUrls: imageUrlsProp = {},
  productNames: productNamesProp = {},
  shippingFee: shippingFeeProp = 0,
  voucherDiscount: voucherDiscountProp = 0,
  subtotal: subtotalProp = 0
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const token = Cookies.get("accessToken");

  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [modalSelectedAddressId, setModalSelectedAddressId] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  // Per-shop shipping fees: Map<shopOwnerId, number>
  const [shopShippingFees, setShopShippingFees] = useState({});
  const [calculatingShipping, setCalculatingShipping] = useState({});

  // Per-shop voucher states: Map<shopOwnerId, voucherInfo>
  const [shopVoucherCodes, setShopVoucherCodes] = useState({});
  const [shopVoucherLoading, setShopVoucherLoading] = useState({});
  const [shopAppliedVouchers, setShopAppliedVouchers] = useState({});

  // Legacy states for backward compatibility
  const [, setShippingFee] = useState(shippingFeeProp);
  const [, setCalculatingShippingFee] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [coinDiscount, setCoinDiscount] = useState(0);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState(null);

  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);

  // NEW: Centralized Checkout State
  const [checkoutData, setCheckoutData] = useState(null);
  const [useCoin, setUseCoin] = useState(false);
  const [platformVoucherCode, setPlatformVoucherCode] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);



  // Fetch Wallet Balance
  useEffect(() => {
    if (userId) {
      const fetchBalance = async () => {
        try {
          const response = await getWalletBalance();
          setWalletBalance(response?.balanceAvailable || 0);
        } catch (error) {
          console.error("Failed to fetch wallet balance", error);
        }
      };
      fetchBalance();
    }
  }, [userId]);

  const selectedItems = location.state?.selectedItems ?? selectedItemsProp;
  const imageUrls = location.state?.imageUrls ?? imageUrlsProp;
  const productNames = location.state?.productNames ?? productNamesProp;
  const subtotal =
    location.state?.subtotal ??
    selectedItems.reduce(
      (sum, it) =>
        sum +
        ((it.totalPrice != null
          ? Number(it.totalPrice)
          : Number(it.unitPrice || it.price || 0) * Number(it.quantity || 0)) || 0),
      0
    ) ??
    subtotalProp;

  // Total is now computed dynamically using per-shop values
  // const total = subtotal + totalShippingFee - totalVoucherDiscount; (calculated after shop data is ready)

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

  const refreshAddresses = async () => {
    setAddressLoading(true);
    try {
      const data = await getAllAddress();
      setAddresses(data);
      const def = data.find((a) => a.isDefault);
      if (def) {
        setSelectedAddressId(def.id);
        setSelectedAddress(def);
      } else if (data.length > 0) {
        setSelectedAddressId(data[0].id);
        setSelectedAddress(data[0]);
      }
    } catch (e) {
      console.error("Failed to refresh addresses:", e);
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
    if (!token) {
      navigate("/login");
      return;
    }
    refreshAddresses();

    // Get userId
    getUser().then(user => {
      setUserId(user?.id || user?.userId || null);
    }).catch((err) => {
      if (err?.response?.status === 401) {
        Cookies.remove("accessToken");
        navigate("/login");
      }
      console.error("Failed to get user:", err);
    });
  }, [token, navigate]);

  // NEW: Centralized Calculation Effect
  useEffect(() => {
    const fetchPreview = async () => {
      if (!selectedAddressId || selectedItems.length === 0 || !userId) {
        setCheckoutData(null);
        return;
      }

      setIsPreviewing(true);
      try {
        // Collect all voucher codes (Shop + Platform)
        // Only include codes that are "applied" or entered?
        // For simplicity, let's look at shopVoucherCodes (input) 
        // In a real app, we might want a separate "appliedCodes" state, but here we can iterate inputs
        const codes = [];
        Object.values(shopVoucherCodes).forEach(c => {
          if (c && c.trim()) codes.push(c.trim());
        });
        if (platformVoucherCode.trim()) codes.push(platformVoucherCode.trim());

        // Prepare request
        const previewReq = {
          addressId: selectedAddressId,
          selectedItems: selectedItems.map(item => ({
            productId: item.productId || item.id,
            sizeId: item.sizeId,
            quantity: item.quantity,
            unitPrice: item.unitPrice || item.price,
            shopOwnerId: item.shopOwnerId,
            shopName: item.shopOwnerName || item.shopName, // Pass name for ease
          })),
          voucherCodes: codes,
          useCoin: useCoin
        };

        const data = await previewCheckout(previewReq);
        setCheckoutData(data);

        // Sync legacy states for backward compatibility (prevent UI crash)
        setShippingFee(data.totalShippingFee || 0);
        // Map shop fees
        const fees = {};
        const appliedVouchers = {};

        if (data.shops) {
          data.shops.forEach(s => {
            fees[s.shopOwnerId] = s.shippingFee - (s.shippingDiscount || 0);
            // If shop has voucher applied in preview
            if (s.shopVoucherCode) {
              appliedVouchers[s.shopOwnerId] = {
                code: s.shopVoucherCode,
                discount: s.shopVoucherDiscount,
                title: "Voucher Shop", // Generic title if not returned
                shopName: s.shopName
              };
            }
          });
        }
        setShopShippingFees(fees);
        setShopAppliedVouchers(appliedVouchers);
        setVoucherDiscount((data.totalShopVoucherDiscount || 0) + (data.totalPlatformVoucherDiscount || 0));
        setCoinDiscount(data.totalCoinDiscount || 0);

      } catch (error) {
        console.error("Preview failed:", error);
      } finally {
        setIsPreviewing(false);
      }
    };

    const timeoutId = setTimeout(fetchPreview, 800); // Debounce
    return () => clearTimeout(timeoutId);
  }, [selectedAddressId, selectedItems, userId, shopVoucherCodes, platformVoucherCode, useCoin]);

  // Update selectedAddress when selectedAddressId changes
  useEffect(() => {
    if (selectedAddressId && addresses.length > 0) {
      const addr = addresses.find((a) => a.id === selectedAddressId);
      setSelectedAddress(addr || null);
    }
  }, [selectedAddressId, addresses]);

  const handleOpenAddressModal = () => {
    setModalSelectedAddressId(selectedAddressId);
    setShowAddressModal(true);
  };

  const handleAddressSelect = (id) => setModalSelectedAddressId(id);


  useEffect(() => {
    if (!showAddressModal) setModalSelectedAddressId(null);
  }, [showAddressModal]);

  // Handle apply voucher for specific shop
  const handleApplyShopVoucher = async (shopOwnerId, shopName) => {
    const code = shopVoucherCodes[shopOwnerId]?.trim();
    if (!code) {
      toast("warning", t('cart.voucher.enterCode', 'Vui lòng nhập mã voucher'));
      return;
    }

    // Calculate shop subtotal for validation
    const shopItems = selectedItems.filter(item => item.shopOwnerId === shopOwnerId);
    const shopSubtotal = shopItems.reduce((sum, it) =>
      sum + ((it.totalPrice != null ? Number(it.totalPrice) : Number(it.unitPrice || 0) * Number(it.quantity || 0)) || 0), 0);

    setShopVoucherLoading(prev => ({ ...prev, [shopOwnerId]: true }));
    try {
      const response = await validateVoucher(code, shopOwnerId, shopSubtotal);

      if (response.valid) {
        setShopAppliedVouchers(prev => ({
          ...prev,
          [shopOwnerId]: {
            code: response.code,
            title: response.title,
            discount: response.discount,
            voucherId: response.voucherId,
            shopName: shopName
          }
        }));
        toast("success", t('cart.voucher.applySuccessWithAmount', {
          amount: formatVND(response.discount),
          defaultValue: `Voucher applied: -${formatVND(response.discount)}`
        }));
      } else {
        toast("error", response.message || t('cart.voucher.invalid'));
      }
    } catch (error) {
      console.error("Validate voucher error:", error);
      toast("error", error?.response?.data?.message || t('cart.voucher.applyFailed'));
    } finally {
      setShopVoucherLoading(prev => ({ ...prev, [shopOwnerId]: false }));
    }
  };

  // Handle remove voucher for specific shop
  const handleRemoveShopVoucher = (shopOwnerId) => {
    setShopVoucherCodes(prev => ({ ...prev, [shopOwnerId]: "" }));
    setShopAppliedVouchers(prev => {
      const newState = { ...prev };
      delete newState[shopOwnerId];
      return newState;
    });
    toast("info", t('cart.voucher.removed', 'Đã hủy voucher'));
  };

  // Calculate shipping fee for specific shop
  const calculateShopShippingFee = async (shopOwnerId, shopItems) => {
    if (!selectedAddress || !selectedAddressId || shopItems.length === 0) {
      return;
    }

    setCalculatingShipping(prev => ({ ...prev, [shopOwnerId]: true }));
    try {
      // Call API with correct parameters: addressId and selectedItems for this shop
      const response = await calculateShippingFee(selectedAddressId, shopItems, shopOwnerId);
      // API returns {shippingFee: number, currency: 'VND'}, extract the number
      const fee = response?.shippingFee ?? response;
      if (fee !== null && fee !== undefined && typeof fee === 'number') {
        setShopShippingFees(prev => ({ ...prev, [shopOwnerId]: fee }));
      } else {
        // Fallback if API returns invalid data
        setShopShippingFees(prev => ({ ...prev, [shopOwnerId]: 30000 }));
      }
    } catch (error) {
      console.error(`[SHIPPING] Failed for shop ${shopOwnerId}:`, error);

      const errorData = error.response?.data;
      if (errorData) {
        console.error('[SHIPPING] Backend Error:', errorData);
        if (errorData.error === 'SHOP_OWNER_ADDRESS_NOT_CONFIGURED') {
          toast("warning", t('checkout.shopAddressMissing', 'Shop chưa cấu hình địa chỉ lấy hàng'));
        } else if (errorData.error === 'ADDRESS_MISSING_GHN_FIELDS') {
          toast("warning", t('checkout.addressMissingInfo', 'Địa chỉ của bạn thiếu thông tin quận/huyện'));
        } else if (errorData.error === 'GHN_API_ERROR') {
          toast("warning", t('checkout.ghnError', 'Lỗi từ đơn vị vận chuyển (GHN). Vui lòng kiểm tra lại địa chỉ giao hàng.'));
        } else if (errorData.message) {
          // Optional: Show other specific errors
          // toast("warning", errorData.message);
        }
      }

      setShopShippingFees(prev => ({ ...prev, [shopOwnerId]: 30000 })); // Default fallback
    } finally {
      setCalculatingShipping(prev => ({ ...prev, [shopOwnerId]: false }));
    }
  };

  // Calculate totals from per-shop data
  const totalShippingFee = Object.values(shopShippingFees).reduce((sum, fee) => sum + (fee || 0), 0);
  const totalVoucherDiscount = Object.values(shopAppliedVouchers).reduce((sum, v) => sum + (v?.discount || 0), 0);
  const total = subtotal + totalShippingFee - totalVoucherDiscount;

  // Legacy handlers for backward compatibility
  const handleApplyVoucher = async () => {
    const shopOwnerId = selectedItems[0]?.shopOwnerId;
    if (shopOwnerId) {
      await handleApplyShopVoucher(shopOwnerId, selectedItems[0]?.shopOwnerName || 'Shop');
    }
  };

  const handleRemoveVoucher = () => {
    const shopOwnerId = selectedItems[0]?.shopOwnerId;
    if (shopOwnerId) {
      handleRemoveShopVoucher(shopOwnerId);
    }
  };

  const handlePlaceOrder = async (e) => {
    e?.preventDefault?.();
    if (orderLoading) return;

    if (selectedItems.length === 0) {
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
      // Compute totals from per-shop values
      const totalShippingFee = Object.values(shopShippingFees).reduce((sum, fee) => sum + Number(fee || 0), 0);
      const totalVoucherDiscount = Object.values(shopAppliedVouchers).reduce((sum, v) => sum + Number(v?.discount || 0), 0);




      // Build orderData - Backend will handle stock reservation
      const orderData = {
        selectedItems: selectedItems.map((it) => ({
          productId: it.productId || it.id,
          sizeId: it.sizeId,
          quantity: it.quantity,
          unitPrice: it.unitPrice || it.price,
          isFlashSale: it.isFlashSale, // Backend uses this flag for reservation routing
          shopOwnerId: it.shopOwnerId // NEW: Include shopOwnerId for proper order splitting
        })),
        addressId: selectedAddressId,
        paymentMethod: paymentMethod || "COD",
        voucherId: appliedVoucher?.voucherId || null,
        voucherDiscount: voucherDiscount || 0,
        platformVoucherCode: platformVoucherCode || null,
        platformVoucherDiscount: checkoutData?.totalPlatformVoucherDiscount || 0,
        shippingFee: totalShippingFee || 0,
        shopShippingFees: shopShippingFees, // NEW: Per-shop shipping fees
        useCoin: useCoin
      };

      Swal.fire({
        title: t('cart.checkout.creatingOrder'),
        text: t('cart.checkout.pleaseWait'),
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });


      // If VNPay or MoMo, create payment first (order will be created after payment success)
      if (paymentMethod === "VNPAY" || paymentMethod === "CARD" || paymentMethod === "MOMO") {
        try {
          // STEP 1: Reserve Flash Sale stock BEFORE redirect (similar to Wallet flow)
          const flashSaleItems = selectedItems.filter(item => item.isFlashSale);
          const tempOrderId = `temp_${userId}_${Date.now()}`;
          const reservedItems = [];

          if (flashSaleItems.length > 0) {
            for (const item of flashSaleItems) {
              try {
                const result = await reserveStock(
                  tempOrderId,
                  item.productId || item.id,
                  item.sizeId,
                  item.quantity
                );

                if (!result.success) {
                  throw new Error(result.message || 'Flash Sale sold out!');
                }

                reservedItems.push({
                  productId: item.productId || item.id,
                  sizeId: item.sizeId
                });

              } catch (error) {
                // Rollback previous reservations
                for (const reserved of reservedItems) {
                  try {
                    await api.post('/stock/reservation/cancel', {
                      productId: reserved.productId,
                      sizeId: reserved.sizeId
                    });
                  } catch (rollbackErr) {
                    console.error('Rollback failed:', rollbackErr);
                  }
                }

                setOrderLoading(false);
                Swal.fire({
                  icon: 'error',
                  title: t('checkout.flashSaleError') || 'Flash Sale Error',
                  text: error.message || 'Flash Sale item is no longer available',
                  confirmButtonText: t('common.ok'),
                });
                return;
              }
            }
          }

          // STEP 2: Calculate final total with shipping, voucher, and COIN discount
          const totalWithShipping = subtotal + totalShippingFee - voucherDiscount - coinDiscount;

          if (!userId) {
            throw new Error("Cannot get user ID");
          }

          // STEP 3: Create payment with order data + tempOrderId + per-shop shipping
          const payPayload = {
            amount: Math.max(1, Math.round(totalWithShipping)),
            orderInfo: "Checkout Orders",
            userId: userId,
            addressId: selectedAddressId,
            orderDataJson: JSON.stringify({
              userId: userId,
              addressId: selectedAddressId,
              shippingFee: totalShippingFee || 0,
              shopShippingFees: shopShippingFees, // NEW: Per-shop shipping fees
              voucherId: appliedVoucher?.voucherId || null,
              voucherDiscount: voucherDiscount || 0,
              platformVoucherCode: platformVoucherCode || null,
              platformVoucherDiscount: checkoutData?.totalPlatformVoucherDiscount || 0,
              useCoin: useCoin, // NEW: Pass useCoin for VNPAY flow
              tempOrderId: tempOrderId, // IMPORTANT: For Flash Sale confirmation
              selectedItems: selectedItems.map(it => ({
                productId: it.productId || it.id,
                sizeId: it.sizeId,
                quantity: it.quantity,
                unitPrice: it.unitPrice || it.price,
                isFlashSale: it.isFlashSale,
                shopOwnerId: it.shopOwnerId // NEW: Include shopOwnerId
              })),
            }),
          };

          let payRes;
          if (paymentMethod === "MOMO") {
            payRes = await createMomoPayment(payPayload);
          } else {
            payRes = await createVnpayPayment(payPayload);
          }
          Swal.close();

          if (payRes?.paymentUrl) {
            // Redirect to payment gateway - order will be created after payment success
            window.location.href = payRes.paymentUrl;
            return;
          } else {
            throw new Error(payRes?.message || "No payment URL returned");
          }
        } catch (payErr) {
          console.error(`Create ${paymentMethod} payment failed:`, payErr);
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

      // Track purchase events for all ordered products
      selectedItems.forEach((item) => {
        trackPurchase(item.productId || item.id, item.quantity || 1);
      });

      // Show success modal with countdown (wait for Kafka to process order)
      let timerInterval;
      await Swal.fire({
        icon: 'success',
        title: t('cart.checkout.orderSuccess') || 'Đặt hàng thành công!',
        html: `
          <div style="text-align: center;">
            <p style="margin-bottom: 16px; color: #666;">
              ${t('cart.checkout.orderProcessing') || 'Đơn hàng của bạn đang được xử lý...'}
            </p>
            <p style="font-size: 14px; color: #999;">
              ${t('cart.checkout.redirectingIn') || 'Chuyển đến danh sách đơn hàng sau'} <b></b> ${t('common.seconds') || 'giây'}
            </p>
          </div>
        `,
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: true,
        confirmButtonText: t('cart.checkout.viewOrders') || 'Xem đơn hàng ngay',
        confirmButtonColor: '#ee4d2d',
        allowOutsideClick: false,
        didOpen: () => {
          const timer = Swal.getHtmlContainer().querySelector('b');
          timerInterval = setInterval(() => {
            const remaining = Math.ceil(Swal.getTimerLeft() / 1000);
            timer.textContent = remaining;
          }, 100);
        },
        willClose: () => {
          clearInterval(timerInterval);
        }
      });

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

  // Group items by shop owner ID (for per-shop logic)
  const itemsByShopId = {};
  selectedItems.forEach((item) => {
    const shopOwnerId = item.shopOwnerId || 'unknown';
    const shopName = item.shopOwnerName || item.shopName || 'Unknown Shop';
    if (!itemsByShopId[shopOwnerId]) {
      itemsByShopId[shopOwnerId] = {
        shopOwnerId,
        shopName,
        items: []
      };
    }
    itemsByShopId[shopOwnerId].items.push(item);
  });

  // Auto-calculate shipping fees when address changes
  useEffect(() => {
    if (selectedAddress && Object.keys(itemsByShopId).length > 0) {
      Object.entries(itemsByShopId).forEach(([shopOwnerId, shopData]) => {
        if (!shopShippingFees[shopOwnerId]) {
          calculateShopShippingFee(shopOwnerId, shopData.items);
        }
      });
    }
  }, [selectedAddress, selectedItems.length]);

  // Legacy grouping for backward compatibility
  const itemsByShop = {};
  selectedItems.forEach((item) => {
    const shopName = item.shopOwnerName || item.shopName || 'Unknown Shop';
    if (!itemsByShop[shopName]) {
      itemsByShop[shopName] = [];
    }
    itemsByShop[shopName].push(item);
  });

  return (
    <>
      <style>{`
        .checkout-page {
          background: #f5f5f5;
          min-height: 100vh;
          padding-bottom: 40px;
        }
        .checkout-header {
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
          padding: 12px 0;
        }
        .checkout-header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .checkout-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 20px;
          font-weight: 600;
          color: #ee4d2d;
        }
        .checkout-logo-separator {
          width: 1px;
          height: 20px;
          background: #ddd;
        }
        .checkout-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .checkout-section {
          background: #fff;
          border-radius: 4px;
          margin-bottom: 20px;
          padding: 20px;
        }
        .checkout-section-title {
          font-size: 16px;
          font-weight: 600;
          color: #ee4d2d;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .checkout-address {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .checkout-address-info {
          flex: 1;
        }
        .checkout-address-name {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
        }
        .checkout-address-details {
          font-size: 14px;
          color: #666;
          line-height: 1.6;
        }
        .checkout-address-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .checkout-btn-default {
          background: #d4a574;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
        }
        .checkout-link {
          color: #1890ff;
          text-decoration: none;
          font-size: 14px;
          cursor: pointer;
        }
        .checkout-link:hover {
          text-decoration: underline;
        }
        .checkout-product-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }
        .checkout-favorite-badge {
          background: #ee4d2d;
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .checkout-shop-name {
          font-size: 14px;
          color: #333;
          font-weight: 600;
        }
        .checkout-chat-btn {
          background: #52c41a;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
        }
        .checkout-product-item {
          display: flex;
          gap: 12px;
          padding: 16px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .checkout-product-item:last-child {
          border-bottom: none;
        }
        .checkout-product-image {
          width: 80px;
          height: 80px;
          object-fit: cover;
          border: 1px solid #f0f0f0;
          border-radius: 4px;
        }
        .checkout-product-info {
          flex: 1;
        }
        .checkout-product-name {
          font-size: 14px;
          color: #333;
          margin-bottom: 8px;
        }
        .checkout-product-details {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          font-size: 13px;
          color: #666;
        }
        .checkout-product-detail-item {
          display: flex;
          flex-direction: column;
        }
        .checkout-product-detail-label {
          color: #999;
          margin-bottom: 4px;
        }
        .checkout-product-detail-value {
          color: #333;
          font-weight: 600;
        }
        .checkout-insurance {
          margin-top: 16px;
          padding: 16px;
          background: #fafafa;
          border-radius: 4px;
          display: flex;
          gap: 12px;
        }
        .checkout-insurance-checkbox {
          width: 18px;
          height: 18px;
          margin-top: 2px;
        }
        .checkout-insurance-content {
          flex: 1;
        }
        .checkout-insurance-title {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
        }
        .checkout-insurance-desc {
          font-size: 13px;
          color: #666;
          line-height: 1.6;
          margin-bottom: 8px;
        }
        .checkout-insurance-price {
          font-size: 14px;
          color: #ee4d2d;
          font-weight: 600;
        }
        .checkout-shipping-method {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px 0;
        }
        .checkout-shipping-info {
          flex: 1;
        }
        .checkout-shipping-label {
          font-size: 14px;
          color: #333;
          margin-bottom: 12px;
        }
        .checkout-shipping-badge {
          background: #52c41a;
          color: #fff;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .checkout-shipping-details {
          font-size: 13px;
          color: #666;
          line-height: 1.6;
          margin-bottom: 8px;
        }
        .checkout-shipping-fee {
          font-size: 14px;
          color: #333;
          font-weight: 600;
          min-width: 100px;
          text-align: right;
        }
        .checkout-payment-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 16px;
          border-bottom: 1px solid #f0f0f0;
        }
        .checkout-payment-tab {
          padding: 12px 16px;
          color: #666;
          text-decoration: none;
          font-size: 14px;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          cursor: pointer;
          position: relative;
        }
        .checkout-payment-tab.active {
          color: #ee4d2d;
          border-bottom-color: #ee4d2d;
        }
        .checkout-payment-tab.active::after {
          content: '✓';
          position: absolute;
          bottom: -2px;
          right: 8px;
          color: #ee4d2d;
          font-size: 12px;
          background: #fff;
          padding: 0 4px;
        }
        .checkout-payment-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #f0f0f0;
          border-radius: 4px;
          margin-bottom: 8px;
          cursor: pointer;
        }
        .checkout-payment-option:hover {
          border-color: #ee4d2d;
        }
        .checkout-payment-option.selected {
          border-color: #ee4d2d;
          background: #fff5f0;
        }
        .checkout-payment-radio {
          width: 18px;
          height: 18px;
        }
        .checkout-payment-info {
          flex: 1;
        }
        .checkout-payment-name {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }
        .checkout-payment-details {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        .checkout-summary {
          background: #fff;
          border-radius: 4px;
          padding: 20px;
          position: sticky;
          top: 20px;
        }
        .checkout-summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }
        .checkout-summary-row.total {
          border-top: 1px solid #f0f0f0;
          padding-top: 16px;
          margin-top: 8px;
        }
        .checkout-summary-label {
          color: #666;
        }
        .checkout-summary-value {
          color: #333;
          font-weight: 600;
        }
        .checkout-summary-value.total {
          color: #ee4d2d;
          font-size: 20px;
        }
        .checkout-place-order {
          background: #ee4d2d;
          color: #fff;
          border: none;
          padding: 14px;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 600;
          width: 100%;
          cursor: pointer;
          margin-top: 20px;
        }
        .checkout-place-order:hover:not(:disabled) {
          background: #d63f21;
        }
        .checkout-place-order:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .checkout-terms {
          font-size: 12px;
          color: #666;
          text-align: center;
          margin-top: 12px;
          line-height: 1.6;
        }
        .checkout-terms-link {
          color: #ee4d2d;
          text-decoration: none;
        }
        .checkout-chat-float {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #ee4d2d;
          color: #fff;
          border: none;
          padding: 12px 20px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
        }
        .modal.show { display: block !important; }
        .modal-backdrop { z-index: 10000 !important; }
        
        .checkout-icon {
          font-size: 18px;
          flex-shrink: 0;
        }
        .checkout-section-title .checkout-icon {
          color: #ee4d2d;
        }
        .checkout-icon-green {
          color: #52c41a;
        }
        .checkout-icon-blue {
          color: #1890ff;
        }
      `}</style>

      <div className="checkout-page">
        {/* Header */}
        <div className="checkout-header">
          <div className="checkout-header-content">
            <div className="checkout-logo">
              <MdShoppingBag style={{ fontSize: '24px' }} /> <span>VIBE SHOP</span>
            </div>
            <div className="checkout-logo-separator"></div>
            <span style={{ color: '#ee4d2d', fontSize: '16px', fontWeight: 600 }}>Checkout</span>
          </div>
        </div>

        <div className="checkout-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
            <div>
              {/* Shipping Address */}
              <div className="checkout-section">
                <div className="checkout-section-title">
                  <MdLocationOn className="checkout-icon" />
                  {t('checkoutPage.shippingAddress', 'Địa Chỉ Nhận Hàng')}
                  {addressLoading && (
                    <small className="text-muted">({t('checkout.loading', 'Đang tải...')})</small>
                  )}
                </div>
                {addressLoading ? (
                  <div style={{ color: '#666', fontSize: '14px', padding: '12px' }}>
                    {t('checkout.loadingAddresses', 'Đang tải địa chỉ...')}
                  </div>
                ) : addresses.length > 0 ? (
                  selectedAddress ? (
                    <div className="checkout-address">
                      <div className="checkout-address-info">
                        <div className="checkout-address-name">
                          {selectedAddress.recipientName} (+84) {selectedAddress.recipientPhone?.replace(/\s/g, '') || 'N/A'}
                        </div>
                        <div className="checkout-address-details">
                          {selectedAddress.streetAddress || ''}<br />
                          {selectedAddress.province || ''}
                        </div>
                      </div>
                      <div className="checkout-address-actions">
                        {selectedAddress.isDefault && (
                          <button className="checkout-btn-default">{t('cart.address.default', 'Mặc Định')}</button>
                        )}
                        <a className="checkout-link" onClick={handleOpenAddressModal}>{t('checkoutPage.change', 'Thay Đổi')}</a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#666', fontSize: '14px' }}>
                      {t('checkout.noAddressSelected', 'Chưa chọn địa chỉ')}
                      <div style={{ marginTop: '12px' }}>
                        <a className="checkout-link" onClick={handleOpenAddressModal}>
                          {t('checkout.selectAddress', 'Chọn địa chỉ')}
                        </a>
                      </div>
                    </div>
                  )
                ) : (
                  <div style={{ color: '#666', fontSize: '14px', padding: '12px' }}>
                    <p>{t('checkout.noAddressesFound', 'Không có địa chỉ. Vui lòng thêm địa chỉ.')}</p>
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      onClick={() => navigate("/information/address")}
                      style={{ marginTop: '8px' }}
                    >
                      {t('checkout.addAddress', 'Thêm địa chỉ')}
                    </button>
                  </div>
                )}
              </div>

              {/* Products - Per Shop Sections */}
              {Object.entries(itemsByShopId).map(([shopOwnerId, shopData]) => {
                const shopItems = shopData.items;
                const shopName = shopData.shopName;
                const shopSubtotal = shopItems.reduce((sum, it) =>
                  sum + ((it.totalPrice != null ? Number(it.totalPrice) : Number(it.unitPrice || 0) * Number(it.quantity || 0)) || 0), 0);
                const shopShipping = shopShippingFees[shopOwnerId] || 0;
                const shopVoucher = shopAppliedVouchers[shopOwnerId];
                const shopVoucherDiscount = shopVoucher?.discount || 0;
                const shopTotal = shopSubtotal + shopShipping - shopVoucherDiscount;

                return (
                  <div key={shopOwnerId} className="checkout-section" style={{ marginBottom: '16px' }}>
                    {/* Shop Header */}
                    <div className="checkout-product-header">
                      <span className="checkout-shop-name">{shopName}</span>
                      <button
                        className="checkout-chat-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          // Dispatch event to open chat with shop (handled by ChatBotWidget)
                          window.dispatchEvent(new CustomEvent('open-chat-with-product', {
                            detail: { shopOwnerId: shopOwnerId, productId: null }
                          }));
                        }}
                      >
                        <MdChat className="checkout-icon" /> {t('checkoutPage.chatNow', 'Chat ngay')}
                      </button>
                    </div>

                    {/* Shop Products */}
                    {shopItems.map((item) => {
                      const pid = item.productId ?? item.id;
                      const img = imageUrls[pid] ?? imgFallback;
                      return (
                        <div key={pid} className="checkout-product-item">
                          <img
                            src={img || imgFallback}
                            alt={productNames[pid] || item.productName || "Product"}
                            className="checkout-product-image"
                            onError={(e) => (e.currentTarget.src = imgFallback)}
                          />
                          <div className="checkout-product-info">
                            <div className="checkout-product-name">
                              {productNames[pid] || item.productName || pid}
                            </div>
                            <div className="checkout-product-details">
                              <div className="checkout-product-detail-item">
                                <span className="checkout-product-detail-label">{t('checkoutPage.classification', 'Phân loại hàng')}</span>
                                <span className="checkout-product-detail-value">{item.sizeName || 'N/A'}</span>
                              </div>
                              <div className="checkout-product-detail-item">
                                <span className="checkout-product-detail-label">{t('checkoutPage.unitPrice', 'Đơn giá')}</span>
                                <span className="checkout-product-detail-value">{formatVND(item.unitPrice || item.price || 0)}</span>
                              </div>
                              <div className="checkout-product-detail-item">
                                <span className="checkout-product-detail-label">{t('checkoutPage.quantity', 'Số lượng')}</span>
                                <span className="checkout-product-detail-value">{item.quantity}</span>
                              </div>
                              <div className="checkout-product-detail-item">
                                <span className="checkout-product-detail-label">{t('checkoutPage.subtotal', 'Thành tiền')}</span>
                                <span className="checkout-product-detail-value" style={{ color: '#ee4d2d' }}>
                                  {formatVND((item.unitPrice || item.price || 0) * item.quantity)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Shop Voucher Input */}
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <HiOutlineTicket className="checkout-icon" style={{ color: '#ee4d2d' }} />
                        <span style={{ fontSize: '14px', color: '#666' }}>{t('cart.voucher.shopVoucher', 'Voucher của Shop')}</span>
                        <input
                          type="text"
                          value={shopVoucherCodes[shopOwnerId] || ''}
                          onChange={(e) => setShopVoucherCodes(prev => ({ ...prev, [shopOwnerId]: e.target.value.toUpperCase() }))}
                          placeholder={t('cart.voucher.placeholder', 'Nhập mã voucher')}
                          disabled={!!shopVoucher}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '13px',
                            backgroundColor: shopVoucher ? '#f5f5f5' : '#fff'
                          }}
                        />
                        {!shopVoucher ? (
                          <button
                            onClick={() => handleApplyShopVoucher(shopOwnerId, shopName)}
                            disabled={shopVoucherLoading[shopOwnerId] || !shopVoucherCodes[shopOwnerId]?.trim()}
                            style={{
                              padding: '8px 16px',
                              background: (shopVoucherLoading[shopOwnerId] || !shopVoucherCodes[shopOwnerId]?.trim()) ? '#ccc' : '#ee4d2d',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '13px',
                              cursor: (shopVoucherLoading[shopOwnerId] || !shopVoucherCodes[shopOwnerId]?.trim()) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {shopVoucherLoading[shopOwnerId] ? t('common.processing', 'Đang xử lý...') : t('cart.voucher.apply', 'Áp dụng')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRemoveShopVoucher(shopOwnerId)}
                            style={{
                              padding: '8px 16px',
                              background: '#fff',
                              color: '#ee4d2d',
                              border: '1px solid #ee4d2d',
                              borderRadius: '4px',
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                          >
                            {t('cart.voucher.cancel', 'Hủy')}
                          </button>
                        )}
                      </div>
                      {shopVoucher && (
                        <div style={{ background: '#e8f5e9', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MdCheckCircle className="checkout-icon-green" /> {shopVoucher.title}: -{formatVND(shopVoucher.discount)}
                        </div>
                      )}
                    </div>

                    {/* Shop Shipping */}
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MdLocalShipping className="checkout-icon" style={{ color: '#00bfa5' }} /> <span>{t('checkoutPage.shippingMethod', 'Phương thức vận chuyển')}: <span style={{ color: '#ee4d2d' }}>{t('checkoutPage.fast', 'Nhanh')}</span></span>
                          {checkoutData?.shops?.find(s => s.shopOwnerId === shopOwnerId)?.isFreeShipXtra && (
                            <span style={{ background: '#00bfa5', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '2px', fontWeight: 600 }}>FREESHIP XTRA</span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {isPreviewing || calculatingShipping[shopOwnerId] ? (
                            <span>...</span>
                          ) : (
                            <div>
                              {checkoutData?.shops?.find(s => s.shopOwnerId === shopOwnerId)?.shippingDiscount > 0 && (
                                <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '13px', marginRight: '6px' }}>
                                  {formatVND((shopShippingFees[shopOwnerId] || 0) + (checkoutData?.shops?.find(s => s.shopOwnerId === shopOwnerId)?.shippingDiscount || 0))}
                                </span>
                              )}
                              <span style={{ fontWeight: 500, color: '#333' }}>
                                {formatVND(shopShippingFees[shopOwnerId])}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Shop Total */}
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>{t('checkoutPage.shopSubtotal')} ({shopItems.length} {t('cart.items', 'sản phẩm')}):</span>
                      <span style={{ color: '#ee4d2d', fontWeight: 600, fontSize: '16px' }}>{formatVND(shopTotal)}</span>
                    </div>
                  </div>
                );
              })}

              {/* Payment Method - Only COD and VNPAY */}
              <div className="checkout-section">
                <div className="checkout-section-title">{t('checkoutPage.paymentMethod')}</div>
                <div className="checkout-payment-tabs">
                  <div
                    className={`checkout-payment-tab ${paymentMethod === 'COD' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('COD')}
                  >
                    {t('checkoutPage.cashOnDelivery')}
                  </div>
                  <div
                    className={`checkout-payment-tab ${paymentMethod === 'VNPAY' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('VNPAY')}
                  >
                    {t('checkout.vnpay')}
                  </div>
                  <div
                    className={`checkout-payment-tab ${paymentMethod === 'MOMO' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('MOMO')}
                  >
                    MoMo
                  </div>
                  <div
                    className={`checkout-payment-tab ${paymentMethod === 'WALLET' ? 'active' : ''}`}
                    onClick={() => {
                      // Allow selection even if balance is low to show error message
                      setPaymentMethod('WALLET');
                    }}
                  >
                    {t('checkout.wallet', 'Wallet')} ({formatVND(walletBalance)})
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <div
                    className={`checkout-payment-option ${paymentMethod === 'COD' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('COD')}
                  >
                    <input
                      type="radio"
                      className="checkout-payment-radio"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                    />
                    <div className="checkout-payment-info">
                      <div className="checkout-payment-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MdPayments className="checkout-icon" /> {t('checkout.cod')}
                      </div>
                      <div className="checkout-payment-details">
                        {t('checkout.codDescription')}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`checkout-payment-option ${paymentMethod === 'WALLET' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('WALLET')}
                  >
                    <input
                      type="radio"
                      className="checkout-payment-radio"
                      checked={paymentMethod === 'WALLET'}
                      onChange={() => setPaymentMethod('WALLET')}
                    />
                    <div className="checkout-payment-info">
                      <div className="checkout-payment-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MdAccountBalanceWallet className="checkout-icon" /> {t('checkout.wallet', 'Checkout with Wallet')} <span style={{ color: '#ee4d2d' }}>({formatVND(walletBalance)})</span>
                      </div>
                      <div className="checkout-payment-details">
                        {walletBalance < (subtotal + totalShippingFee - totalVoucherDiscount) ?
                          <span style={{ color: 'red' }}>{t('checkout.insufficientBalance', 'Insufficient balance')}</span>
                          : t('checkout.walletDescription', 'Use wallet balance to pay')}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`checkout-payment-option ${paymentMethod === 'VNPAY' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('VNPAY')}
                  >
                    <input
                      type="radio"
                      className="checkout-payment-radio"
                      checked={paymentMethod === 'VNPAY'}
                      onChange={() => setPaymentMethod('VNPAY')}
                    />
                    <div className="checkout-payment-info">
                      <div className="checkout-payment-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MdPayments className="checkout-icon-blue" /> {t('checkout.vnpay')}
                      </div>
                      <div className="checkout-payment-details">
                        {t('checkout.vnpayDescription')}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`checkout-payment-option ${paymentMethod === 'MOMO' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('MOMO')}
                  >
                    <input
                      type="radio"
                      className="checkout-payment-radio"
                      checked={paymentMethod === 'MOMO'}
                      onChange={() => setPaymentMethod('MOMO')}
                    />
                    <div className="checkout-payment-info">
                      <div className="checkout-payment-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MdPayments className="checkout-icon" style={{ color: '#a50064' }} /> MoMo
                      </div>
                      <div className="checkout-payment-details">
                        {t('checkout.momoDescription', 'Checkout with MoMo')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="checkout-summary">
              {/* Platform Voucher & Coin Section */}
              <div style={{ padding: '12px 0', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', marginBottom: '12px' }}>
                {/* Platform Voucher */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MdCardGiftcard className="checkout-icon" style={{ color: '#ee4d2d' }} /> {t('cart.voucher.platformVoucher', 'Platform Voucher')}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Platform promo code..."
                      value={platformVoucherCode}
                      onChange={(e) => setPlatformVoucherCode(e.target.value)}
                      style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }}
                    />
                    {/* Input change triggers effect automatically via debouncing */}
                  </div>
                  {checkoutData?.platformVoucherValue > 0 && (
                    <div style={{ fontSize: '12px', color: '#52c41a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MdCheckCircle /> Saved {formatVND(checkoutData.platformVoucherValue)}
                    </div>
                  )}
                </div>

                {/* Shop Coin */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MdMonetizationOn className="checkout-icon" style={{ color: '#ffb100' }} /> {t('cart.coin.useCoin', 'Use Vibe Coin')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {t('cart.coin.available', 'Available')}: {checkoutData?.availableCoins || 0} coins
                      {useCoin && checkoutData?.totalCoinDiscount > 0 && <span style={{ color: '#ee4d2d', marginLeft: '4px' }}>(-{formatVND(checkoutData.totalCoinDiscount)})</span>}
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={useCoin}
                      onChange={(e) => setUseCoin(e.target.checked)}
                      disabled={!checkoutData || checkoutData.availableCoins <= 0}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              {/* Summary Rows */}
              <div className="checkout-summary-row">
                <span className="checkout-summary-label">{t('checkoutPage.totalMerchandise')}</span>
                <span className="checkout-summary-value">{formatVND(checkoutData?.subtotal || subtotal)}</span>
              </div>
              <div className="checkout-summary-row">
                <span className="checkout-summary-label">{t('checkoutPage.totalShippingFee')}</span>
                <span className="checkout-summary-value">
                  {isPreviewing ? <small>...</small> : formatVND(checkoutData?.totalShippingFee ?? totalShippingFee)}
                </span>
              </div>

              {/* Discounts */}
              <div className="checkout-summary-row">
                <span className="checkout-summary-label">{t('checkoutPage.totalVoucherDiscount')} (Shop)</span>
                <span className="checkout-summary-value" style={{ color: '#ee4d2d' }}>
                  -{formatVND(checkoutData?.totalShopVoucherDiscount || 0)}
                </span>
              </div>
              {checkoutData?.totalPlatformVoucherDiscount > 0 && (
                <div className="checkout-summary-row">
                  <span className="checkout-summary-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MdLocalActivity /> {t('checkoutPage.platformDiscount', 'Platform Discount')}
                  </span>
                  <span className="checkout-summary-value" style={{ color: '#ee4d2d' }}>
                    -{formatVND(checkoutData.totalPlatformVoucherDiscount)}
                  </span>
                </div>
              )}
              {checkoutData?.totalCoinDiscount > 0 && (
                <div className="checkout-summary-row">
                  <span className="checkout-summary-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MdStars style={{ color: '#ffb100' }} /> {t('checkoutPage.coinDiscount', 'Coin Benefit')}
                  </span>
                  <span className="checkout-summary-value" style={{ color: '#ee4d2d' }}>
                    -{formatVND(checkoutData.totalCoinDiscount)}
                  </span>
                </div>
              )}

              <div className="checkout-summary-row total">
                <span className="checkout-summary-label">{t('checkoutPage.totalPayment')}</span>
                <span className="checkout-summary-value total">
                  {isPreviewing ? "..." : formatVND(checkoutData?.finalAmount || 0)}
                </span>
              </div>
              <button
                className="checkout-place-order"
                onClick={handlePlaceOrder}
                disabled={orderLoading || selectedItems.length === 0 || !selectedAddressId}
                title={
                  selectedItems.length === 0
                    ? t('checkout.pleaseSelectAtLeastOneItem')
                    : !selectedAddressId
                      ? t('checkout.pleaseSelectDeliveryAddress')
                      : ""
                }
              >
                {orderLoading ? t('checkout.creatingOrder') : t('checkoutPage.placeOrder')}
              </button>
            </div>
          </div>
        </div >

        {/* Floating Chat Button */}
        <button className="checkout-chat-float">
          <MdChat className="checkout-icon" /> Chat
        </button>

        {/* Address Selection Modal */}
        {
          showAddressModal &&
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
              <div className="modal-dialog modal-lg" role="document" style={{ maxWidth: '600px' }}>
                <div className="modal-content" style={{ borderRadius: '4px' }}>
                  {/* Modal Header - Shopee style */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    borderBottom: '1px solid #e8e8e8',
                    backgroundColor: '#fff'
                  }}>
                    <h5 style={{ margin: 0, fontWeight: 600, fontSize: '18px', color: '#333' }}>
                      {t('checkoutPage.myAddresses', 'My Addresses')}
                    </h5>
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        color: '#999',
                        cursor: 'pointer',
                        padding: '0',
                        lineHeight: '1'
                      }}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>

                  <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto', padding: 0 }}>
                    {addresses.length === 0 ? (
                      <div className="text-center p-4">
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
                      <div>
                        {addresses.map((a, index) => (
                          <div
                            key={a.id}
                            onClick={() => handleAddressSelect(a.id)}
                            style={{
                              padding: '16px 20px',
                              borderBottom: index < addresses.length - 1 ? '1px solid #f0f0f0' : 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              gap: '16px',
                              alignItems: 'flex-start',
                              backgroundColor: modalSelectedAddressId === a.id ? '#fff8f6' : '#fff'
                            }}
                          >
                            {/* Radio Button */}
                            <div style={{ paddingTop: '4px' }}>
                              <input
                                type="radio"
                                checked={modalSelectedAddressId === a.id}
                                onChange={() => handleAddressSelect(a.id)}
                                style={{ width: '18px', height: '18px', accentColor: '#ee4d2d' }}
                              />
                            </div>

                            {/* Address Info */}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600, color: '#333' }}>{a.recipientName}</span>
                                <span style={{ color: '#999' }}>|</span>
                                <span style={{ color: '#666' }}>(+84) {a.recipientPhone?.replace('+84', '').replace(/^0/, '')}</span>
                              </div>
                              <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                                {a.streetAddress}
                                <br />
                                {a.province}
                              </div>
                              {a.isDefault && (
                                <span style={{
                                  display: 'inline-block',
                                  marginTop: '8px',
                                  padding: '2px 6px',
                                  border: '1px solid #ee4d2d',
                                  color: '#ee4d2d',
                                  fontSize: '11px',
                                  borderRadius: '2px'
                                }}>
                                  {t('cart.address.default', 'Mặc định')}
                                </span>
                              )}
                            </div>

                            {/* Update Link */}
                            <div>
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowAddressModal(false);
                                  navigate(`/information/address?edit=${a.id}`);
                                }}
                                style={{ color: '#1890ff', fontSize: '13px', textDecoration: 'none' }}
                              >
                                {t('checkoutPage.update', 'Update')}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="modal-footer" style={{ justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #e8e8e8' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressModal(false);
                        navigate("/information/address");
                      }}
                      style={{
                        padding: '10px 24px',
                        background: '#ee4d2d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      + {t('checkoutPage.addNewAddress', 'Thêm Địa Chỉ Mới')}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        }
      </div >
    </>
  );
}
