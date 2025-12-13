import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { useEffect } from 'react';
import HomePage from "./pages/client/HomePage.jsx";
import AuthPage from "./pages/client/AuthPage.jsx";
import UserPage from "./pages/client/UserPage.jsx";
import ShopPage from "./pages/client/ShopPage.jsx";
import CartPage from "./pages/client/CartPage.jsx";
import GoogleCallback from "./pages/client/GoogleCallback.jsx";
import VnpayReturnPage from "./pages/client/VnpayReturnPage.jsx";
import ForgotPasswordPage from "./pages/client/ForgotPasswordPage.jsx";
import VerifyOtpPage from "./pages/client/VerifyOtpPage.jsx";
import ResetPasswordPage from "./pages/client/ResetPasswordPage.jsx";
import AdminLayout from "./components/admin/AdminLayout.jsx";
import ProtectedRoute from "./components/admin/ProtectedRoute.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import DataTablesPage from "./pages/admin/DataTablesPage.jsx";
import ChartAdmin from "./pages/admin/ChartAdmin.jsx";
import OrdersPage from "./pages/admin/OrdersPage.jsx";
import RolesPage from "./pages/admin/RolesPage.jsx";
import CategoriesPage from "./pages/admin/categoeis/CategoriesPage.jsx";
import ProductsPage from "./pages/admin/products/ProductsPage.jsx";
import ContactPage from "./pages/client/ContactPage.jsx";
import Logout from "./components/admin/Logout.jsx";
import ProductDetailPage from "./pages/client/ProductDetailPage.jsx";
import ShopDetailPage from "./pages/client/ShopDetailPage.jsx";
import ShopOwnerLayout from "./components/shop-owner/ShopOwnerLayout.jsx";
import ShopOwnerDashboard from "./pages/shop-owner/ShopOwnerDashboard.jsx";
import AllProductsPage from "./pages/shop-owner/AllProductsPage.jsx";
import AddProductPage from "./pages/shop-owner/AddProductPage.jsx";
import ReturnOrderPage from "./pages/shop-owner/ReturnOrderPage.jsx";
import BulkShippingPage from "./pages/shop-owner/BulkShippingPage.jsx";
import AnalyticsPage from "./pages/shop-owner/AnalyticsPage.jsx";
import SettingsPage from "./pages/shop-owner/SettingsPage.jsx";
import NotificationPage from "./pages/shop-owner/NotificationPage.jsx";
import ChatPage from "./pages/shop-owner/ChatPage.jsx";

// Component to scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/information/*" element={<UserPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/oauth2/callback" element={<GoogleCallback />} />
          <Route path="/payment/vnpay/return" element={<VnpayReturnPage />} />
          <Route path="/forgot" element={<ForgotPasswordPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/shop/:userId" element={<ShopDetailPage />} />
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
            <Route path="orders" element={<OrdersPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="role-request" element={<RolesPage />} />
            <Route path="charts" element={<ChartAdmin />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="logout" element={<Logout />} />
          </Route>
          {/* Shop Owner routes */}
            {/* Shop Owner routes */}
            <Route
                path="/shop-owner/*"
                element={
                    <ProtectedRoute allowedRoles={["ROLE_SHOP_OWNER"]}>
                        <ShopOwnerLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<ShopOwnerDashboard />} />
                <Route path="products" element={<AllProductsPage />} />
                <Route path="products/add" element={<AddProductPage />} />
                <Route path="products/edit/:id" element={<AddProductPage />} />
                <Route path="orders/returns" element={<ReturnOrderPage />} />
                <Route path="orders/bulk-shipping" element={<BulkShippingPage />} />

                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="notifications" element={<NotificationPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="logout" element={<Logout />} />
            </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
} 