import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { useEffect } from 'react';
import HomePage from "./pages/client/HomePage.jsx";
import AuthPage from "./pages/client/AuthPage.jsx";
import UserPage from "./pages/client/UserPage.jsx";
import ShopPage from "./pages/client/ShopPage.jsx";
import CartPage from "./pages/client/CartPage.jsx";
import CheckoutPage from "./pages/client/CheckoutPage.jsx";
import GoogleCallback from "./pages/client/GoogleCallback.jsx";
import VnpayReturnPage from "./pages/client/VnpayReturnPage.jsx";
import ForgotPasswordPage from "./pages/client/ForgotPasswordPage.jsx";
import VerifyOtpPage from "./pages/client/VerifyOtpPage.jsx";
import ResetPasswordPage from "./pages/client/ResetPasswordPage.jsx";
import AdminLayout from "./components/admin/AdminLayout.jsx";
import ProtectedRoute from "./components/admin/ProtectedRoute.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import DataTablesPage from "./pages/admin/DataTablesPage.jsx";
import RolesPage from "./pages/admin/RolesPage.jsx";
import ContactPage from "./pages/client/ContactPage.jsx";
import Logout from "./components/admin/Logout.jsx";
import ProductDetailPage from "./pages/client/ProductDetailPage.jsx";
import ShopDetailPage from "./pages/client/ShopDetailPage.jsx";
import TrackingPage from "./pages/client/TrackingPage.jsx";
import ShopOwnerLayout from "./components/shop-owner/ShopOwnerLayout.jsx";
import ShopOwnerDashboard from "./pages/shop-owner/ShopOwnerDashboard.jsx";
import AllProductsPage from "./pages/shop-owner/AllProductsPage.jsx";

import InventoryPage from "./pages/shop-owner/InventoryPage.jsx";
import AddProductPage from "./pages/shop-owner/AddProductPage.jsx";
import ReturnOrderPage from "./pages/shop-owner/ReturnOrderPage.jsx";
import BulkShippingPage from "./pages/shop-owner/BulkShippingPage.jsx";
import AnalyticsPage from "./pages/shop-owner/AnalyticsPage.jsx";
import SettingsPage from "./pages/shop-owner/SettingsPage.jsx";
import NotificationPage from "./pages/shop-owner/NotificationPage.jsx";
import ChatPage from "./pages/shop-owner/ChatPage.jsx";
import WalletPage from "./pages/shop-owner/WalletPage.jsx";
import SubscriptionPage from "./pages/shop-owner/SubscriptionPage.jsx";
import LiveStreamPage from "./pages/shop-owner/LiveStreamPage.jsx";

import LiveListPage from "./pages/client/LiveListPage.jsx";
import LiveWatchPage from "./pages/client/LiveWatchPage.jsx";
import LiveManagePage from "./pages/live/LiveManagePage.jsx";
import VoucherManagementPage from "./pages/admin/VoucherManagementPage.jsx";
import CoinManagement from "./components/admin/coins/CoinManagement.jsx";
import SubscriptionPlanManagementPage from "./pages/admin/SubscriptionPlanManagementPage.jsx";
import BannerManagementPage from "./pages/admin/BannerManagementPage.jsx";
import ShopOwnerManagementPage from "./pages/admin/ShopOwnerManagementPage.jsx";
import RegisterShopOwner from "./pages/client/RegisterShopOwner.jsx";
import ReviewManagementPage from "./pages/shop-owner/ReviewManagementPage.jsx";
import CategoriesPage from "./pages/admin/categoeis/CategoriesPage.jsx";
import ChatBotWidget from "./components/client/ChatBotWidget.jsx";
import AIChatWidget from "./components/client/AIChatWidget.jsx";
import ShopVoucherPage from "./pages/shop-owner/VoucherManagementPage.jsx";
import AdManagement from "./components/admin/ads/AdManagement.jsx";
import ShopAdRequest from "./components/shop-owner/ads/ShopAdRequest.jsx";
import AdminFlashSale from "./components/admin/flashsale/AdminFlashSale.jsx";
import FlashSale from "./components/client/FlashSale.jsx";
import ShopFlashSale from "./components/shop-owner/flashsale/ShopFlashSale.jsx";
import ShopDecorationPage from "./pages/shop-owner/ShopDecorationPage.jsx";

// Component to scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// Global Chat Widget - only show on client pages 
function GlobalChatWidget() {
  const { pathname } = useLocation();

  // Don't show chat on admin or shop-owner routes
  const isAdminRoute = pathname.startsWith('/admin');
  const isShopOwnerRoute = pathname.startsWith('/shop-owner');
  const isLiveRoute = pathname.startsWith('/live');
  const isAuthRoute = pathname.startsWith('/login')
    || pathname.startsWith('/register')
    || pathname.startsWith('/auth')
    || pathname.startsWith('/forgot')
    || pathname.startsWith('/verify-otp')
    || pathname.startsWith('/reset-password')
    || pathname.startsWith('/cart')
    || pathname.startsWith('/checkout');

  if (isAdminRoute || isShopOwnerRoute || isLiveRoute || isAuthRoute) {
    return null;
  }

  return (
    <>
      <ChatBotWidget />
      <AIChatWidget />
    </>
  );
}


import { Toaster } from 'react-hot-toast';

// ... (other imports)

// Global Chat Widget - only show on client pages 
// ...

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ScrollToTop />
        <GlobalChatWidget />
        <Toaster position="top-right" reverseOrder={false} />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/information/*" element={<UserPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/oauth2/callback" element={<GoogleCallback />} />
          <Route path="/payment/vnpay/return" element={<VnpayReturnPage />} />
          <Route path="/forgot" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/shop/:userId" element={<ShopDetailPage />} />
          <Route path="/order/track/:orderId" element={<TrackingPage />} />
          <Route path="/register-shopowner" element={<RegisterShopOwner />} />
          {/* Live Stream routes (client) */}
          <Route path="/live" element={<LiveListPage />} />
          <Route path="/live/manage" element={<LiveManagePage />} />
          <Route path="/live/:roomId" element={<LiveWatchPage />} />
          <Route path="/flash-sale" element={<FlashSale />} />

          {/* Admin routes */}
          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={["ROLE_ADMIN"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="tables/datatables" element={<DataTablesPage />} />

            <Route path="role-request" element={<RolesPage />} />
            <Route path="flash-sale" element={<AdminFlashSale />} />
            <Route path="shop-owners" element={<ShopOwnerManagementPage />} />
            <Route path="banner" element={<BannerManagementPage />} />
            <Route path="voucher" element={<VoucherManagementPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="subscription" element={<SubscriptionPlanManagementPage />} />
            <Route path="ads" element={<AdManagement />} />
            <Route path="coins" element={<CoinManagement />} />
            <Route path="logout" element={<Logout />} />
          </Route>

          {/* Shop Owner routes */}
          <Route
            path="/shop-owner/*"
            element={
              <ProtectedRoute allowedRoles={["ROLE_SHOP_OWNER"]}>
                <ShopOwnerLayout />
              </ProtectedRoute>
            }
          >
            <Route path="live" element={<LiveStreamPage />} />
            <Route index element={<ShopOwnerDashboard />} />
            <Route path="products" element={<AllProductsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="products/add" element={<AddProductPage />} />
            <Route path="products/edit/:id" element={<AddProductPage />} />
            <Route path="orders/returns" element={<ReturnOrderPage />} />
            <Route path="orders/bulk-shipping" element={<BulkShippingPage />} />
            <Route path="reviews" element={<ReviewManagementPage />} />
            <Route path="vouchers" element={<ShopVoucherPage />} />
            <Route path="decoration" element={<ShopDecorationPage />} />
            <Route path="flash-sale" element={<ShopFlashSale />} />
            <Route path="ads" element={<ShopAdRequest />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="notifications" element={<NotificationPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="ads" element={<ShopAdRequest />} />
            <Route path="logout" element={<Logout />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
} 