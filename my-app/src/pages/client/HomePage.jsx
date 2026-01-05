import React, { useEffect } from 'react';
import Header from "../../components/client/Header.jsx";
import Footer from "../../components/client/Footer.jsx";
import ShopeeBanner from "../../components/client/ShopeeBanner.jsx";
import ShopeeCategoryGrid from "../../components/client/ShopeeCategoryGrid.jsx";
import FlashSale from "../../components/client/FlashSale.jsx";
import TopSearch from "../../components/client/TopSearch.jsx";
import TodaysSuggestions from "../../components/client/TodaysSuggestions.jsx";
import AdDisplay from "../../components/client/ads/AdDisplay.jsx";
// Phase 2: Personalized Recommendations
import RecentlyViewed from "../../components/client/RecentlyViewed.jsx";
import PersonalizedRecommendations from "../../components/client/PersonalizedRecommendations.jsx";
import TrendingProducts from "../../components/client/TrendingProducts.jsx";
import { trackSiteVisit } from "../../api/analyticsApi.js";


export default function HomePage() {
  useEffect(() => {
    trackSiteVisit();
  }, []);

  return (
    <div className="wrapper" style={{ background: '#F5F5F5', minHeight: '100vh' }}>
      <AdDisplay placement="POPUP" />
      <Header />
      <main style={{ width: '100%', overflowX: 'hidden' }}>
        {/* Banner Section - Shopee Style */}
        <ShopeeBanner />

        {/* Category Section */}
        <ShopeeCategoryGrid />

        {/* Recently Viewed - Chỉ hiển thị khi đã đăng nhập và có data */}
        <RecentlyViewed />

        {/* Flash Sale Section - Giữ nguyên */}
        <FlashSale />

        {/* Personalized Recommendations - Chỉ hiển thị khi đã đăng nhập */}
        <PersonalizedRecommendations />

        {/* Top Search Section */}
        <TopSearch />

        {/* Trending Products - Hiển thị cho tất cả (Guest + User) */}
        <TrendingProducts />

        {/* Today's Suggestions Section */}
        <TodaysSuggestions />
      </main>
      <Footer />
    </div>
  );
}
