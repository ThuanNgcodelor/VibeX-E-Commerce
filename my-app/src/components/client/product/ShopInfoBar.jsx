import React, { useEffect, useState } from "react";
import { getShopStats } from "../../../api/product.js";
import { getFollowerCount, checkIsFollowing, followShop, unfollowShop } from "../../../api/user.js";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function ShopInfoBar({
  shopOwner,
  onChat,
  onViewShop,
}) {
  const [stats, setStats] = useState({ productCount: 0, avgRating: 0 });
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [joinedText, setJoinedText] = useState("Recently joined");
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (shopOwner?.userId) {
      // Fetch Shop Stats
      getShopStats(shopOwner.userId).then((data) => {
        setStats({
          productCount: data.productCount || 0,
          avgRating: data.avgRating || 0,
          responseRate: data.responseRate || 0,
          totalReviews: data.totalReviews || 0,
          responseTime: data.responseTime || t('shop.na')
        });
      }).catch(err => console.error("Failed to fetch shop stats", err));

      // Fetch Follower Count
      getFollowerCount(shopOwner.userId).then((count) => {
        setFollowerCount(count || 0);
      }).catch(err => console.error("Failed to fetch follower count", err));

      // Check Following Status
      checkIsFollowing(shopOwner.userId).then(status => {
        setIsFollowing(status);
      }).catch(err => console.error("Failed to check follow status", err));

      // Calculate Joined Date
      if (shopOwner.createdAt) {
        const date = new Date(shopOwner.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffYears >= 1) {
          setJoinedText(t('shop.yearsAgo', { count: diffYears }));
        } else if (diffMonths >= 1) {
          setJoinedText(t('shop.monthsAgo', { count: diffMonths }));
        } else if (diffDays >= 1) {
          setJoinedText(t('shop.daysAgo', { count: diffDays }));
        } else {
          const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
          if (diffHours >= 1) {
            setJoinedText(t('shop.hoursAgo', { count: diffHours }));
          } else {
            setJoinedText(t('shop.justNow'));
          }
        }
      }
    }
  }, [shopOwner, t]);

  if (!shopOwner) {
    return null;
  }

  const formatCount = (count) => {
    if (!count) return '0';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await unfollowShop(shopOwner.userId);
        setFollowerCount(prev => Math.max(0, prev - 1));
        setIsFollowing(false);
      } else {
        await followShop(shopOwner.userId);
        setFollowerCount(prev => prev + 1);
        setIsFollowing(true);
      }
    } catch (e) {
      if (e?.response?.status === 403 || e?.response?.status === 401) {
        toast.error(t("auth.loginRequired"));
        navigate("/login");
      } else {
        console.error("Failed to update follow status", e);
      }
    }
  };

  return (
    <div className="border rounded-3 p-3 mb-3 bg-white">
      <div className="d-flex align-items-center gap-3 flex-wrap">
        <div className="d-flex align-items-center gap-3 flex-grow-1">
          {shopOwner.imageUrl ? (
            <img
              src={`/v1/file-storage/get/${shopOwner.imageUrl}`}
              alt={shopOwner.shopName}
              style={{
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: "50%",
                border: "2px solid #ee4d2d"
              }}
            />
          ) : (
            <div
              className="rounded-circle d-flex align-items-center justify-content-center"
              style={{
                width: 64,
                height: 64,
                background: "#ee4d2d",
                color: "white",
                fontSize: "1.5rem",
                fontWeight: "bold"
              }}
            >
              {shopOwner.shopName?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="fw-bold">
              {shopOwner.shopName}
              {shopOwner.verified && (
                <i className="fas fa-check-circle text-primary ms-2" title="Verified Shop"></i>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: "0.9rem" }}>
              {t('shop.online')} 3 {t('shop.minutesAgo', { count: 3 })}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-shop-outline"
            onClick={handleFollow}
          >
            {isFollowing ? <><i className="fas fa-check me-1" /> {t('shop.followingStatus')}</> : <><i className="fas fa-plus me-1" /> {t('shop.follow')}</>}
          </button>
          <button className="btn btn-shop-primary" onClick={onChat}>
            <i className="fa fa-comments me-1" /> {t('shop.chat')}
          </button>
          <button className="btn btn-shop-outline" onClick={onViewShop}>
            <i className="fa fa-store me-1" /> {t('shop.viewShop')}
          </button>
        </div>
      </div>

      <hr className="my-3" />

      <div className="row text-center g-2">
        <div className="col-6 col-md-2">
          <div className="text-muted">{t('shop.rating')}</div>
          <div className="fw-bold" style={{ color: '#ee4d2d' }}>
            {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "0.0"}
            <span className="text-muted small ms-1">({stats.totalReviews || 0})</span>
          </div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">{t('shop.chatResponse')}</div>
          <div className="fw-bold" style={{ color: '#ee4d2d' }}>
            {stats.responseRate !== undefined ? `${stats.responseRate}%` : t('shop.na')}
          </div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">{t('shop.products')}</div>
          <div className="fw-bold" style={{ color: '#ee4d2d' }}>{formatCount(stats.productCount)}</div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">{t('shop.responseTime')}</div>
          <div className="fw-bold" style={{ color: '#ee4d2d' }}>{stats.responseTime || t('shop.na')}</div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">{t('shop.joined')}</div>
          <div className="fw-bold" style={{ color: '#ee4d2d' }}>{joinedText}</div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">{t('shop.followers')}</div>
          <div className="fw-bold" style={{ color: '#ee4d2d' }}>{formatCount(followerCount)}</div>
        </div>
      </div>
    </div >
  );
}
