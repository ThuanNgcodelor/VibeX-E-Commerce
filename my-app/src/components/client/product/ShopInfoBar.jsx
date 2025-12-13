import React, { useEffect, useState } from "react";
import { getShopStats } from "../../../api/product.js";
import { getFollowerCount } from "../../../api/user.js";

export default function ShopInfoBar({
  shopOwner,
  onChat,
  onViewShop,
}) {
  const [stats, setStats] = useState({ productCount: 0, avgRating: 0 });
  const [followerCount, setFollowerCount] = useState(0);
  const [joinedText, setJoinedText] = useState("Recently joined");

  useEffect(() => {
    if (shopOwner?.userId) {
      // Fetch Shop Stats
      getShopStats(shopOwner.userId).then((data) => {
        setStats({
          productCount: data.productCount || 0,
          avgRating: data.avgRating || 0
        });
      }).catch(err => console.error("Failed to fetch shop stats", err));

      // Fetch Follower Count
      getFollowerCount(shopOwner.userId).then((count) => {
        setFollowerCount(count || 0);
      }).catch(err => console.error("Failed to fetch follower count", err));

      // Calculate Joined Date
      if (shopOwner.createdAt) {
        const date = new Date(shopOwner.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffYears >= 1) {
          setJoinedText(`${diffYears} years ago`);
        } else if (diffMonths >= 1) {
          setJoinedText(`${diffMonths} months ago`);
        } else if (diffDays >= 1) {
          setJoinedText(`${diffDays} days ago`);
        } else {
          const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
          if (diffHours >= 1) {
            setJoinedText(`${diffHours} hours ago`);
          } else {
            setJoinedText("Just now");
          }
        }
      }
    }
  }, [shopOwner]);

  if (!shopOwner) {
    return null;
  }

  const formatCount = (count) => {
    if (!count) return '0';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
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
              onError={(e) => {
                e.currentTarget.src = "/vite.svg";
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
              Online 3 minutes ago
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-danger" onClick={onChat}>
            <i className="fa fa-comments me-1" /> Chat Now
          </button>
          <button className="btn btn-danger" onClick={onViewShop}>
            <i className="fa fa-store me-1" /> View Shop
          </button>
        </div>
      </div>

      <hr className="my-3" />

      <div className="row text-center g-2">
        <div className="col-6 col-md-2">
          <div className="text-muted">Ratings</div>
          <div className="text-danger fw-bold">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "0.0"}</div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">Response Rate</div>
          <div className="text-danger fw-bold">N/A</div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">Products</div>
          <div className="text-danger fw-bold">{formatCount(stats.productCount)}</div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">Response Time</div>
          <div className="text-danger fw-bold">N/A</div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">Joined</div>
          <div className="text-danger fw-bold">{joinedText}</div>
        </div>
        <div className="col-6 col-md-2">
          <div className="text-muted">Followers</div>
          <div className="text-danger fw-bold">{formatCount(followerCount)}</div>
        </div>
      </div>
    </div>
  );
}
