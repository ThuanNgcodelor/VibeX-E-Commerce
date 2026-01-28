import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import imgFallback from "../../../assets/images/shop/6.png";

import {
  fetchProducts,
} from "../../../api/product.js";

const AllProduct = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const topSix = useMemo(() => {
    const safe = Array.isArray(products) ? products.slice() : [];
    console.log("🛍️ All products:", safe.length);

    const withStock = safe.map((p) => {
      let totalStock = 0;
      if (p.sizes && Array.isArray(p.sizes)) {
        totalStock = p.sizes.reduce((sum, size) => {
          return sum + (Number(size.stock) || 0);
        }, 0);
      }
      return { ...p, stock: totalStock };
    });

    const inStock = withStock.filter((p) => p.stock > 0);

    const sorted = inStock.sort((a, b) => b.stock - a.stock);
    const top = sorted.slice(0, 6);

    return top;
  }, [products]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetchProducts();
        setProducts(res.data ? res.data : []);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);


  if (loading) {
    return (
      <section className="product-area section-space">
        <div className="container">
          <div className="section-title text-center">
            <h2 className="title">Top 6 In-Stock Products</h2>
            <p>Loading products...</p>
          </div>
          <div className="text-center py-5">
            <i className="fa fa-spinner fa-spin fa-3x" style={{ color: '#6c757d' }}></i>
            <p className="mt-3">Please wait while we load the products...</p>
          </div>
        </div>
      </section>
    );
  }

  if (topSix.length === 0 && !loading) {
    return (
      <section className="product-area section-space">
        <div className="container">
          <div className="section-title text-center">
            <h2 className="title">Top 6 In-Stock Products</h2>
            <p>No products available at the moment.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="product-area section-space">
      <div className="container">
        <div className="section-title text-center">
          <h2 className="title">Top 6 In-Stock Products</h2>
          <p>Showing products with the highest available stock.</p>
        </div>

        <div className="row mb-n6">
          {topSix.map((product) => (
            <div className="col-sm-6 col-lg-4 mb-6" key={product.id}>
              <div className="product-item product-item-border">
                <Link className="product-thumb" to={`/product/${product.id}`} style={{
                  display: 'block',
                  position: 'relative',
                  paddingBottom: '100%',
                  overflow: 'hidden',
                  backgroundColor: '#f8f9fa'
                }}>
                  <img
                    src={product.imageId ? `/v1/file-storage/get/${product.imageId}` : imgFallback}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = imgFallback;
                    }}
                    alt={product.name}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </Link>
                {product.status && (
                  <span className="badges">{product.status}</span>
                )}

                <div className="product-action">
                  <button
                    type="button"
                    className="product-action-btn"
                    title="Quick View"
                  >
                    <i className="fa fa-expand" />
                  </button>
                  <button type="button" className="product-action-btn">
                    <i className="fa fa-shopping-cart" />
                  </button>
                  <button
                    type="button"
                    className="product-action-btn"
                    title="Compare"
                  >
                    <i className="fa fa-exchange" />
                  </button>
                </div>

                <div className="product-info">
                  <h4 className="title">
                    <Link to={`/product/${product.id}`}>{product.name}</Link>
                  </h4>
                  <div className="price">
                    {"$" + Number(product.price || 0).toLocaleString("en-US")}
                    {product.originalPrice &&
                      Number(product.originalPrice) !==
                      Number(product.price) && (
                        <span className="price-old">
                          {" $" +
                            Number(product.originalPrice).toLocaleString(
                              "en-US"
                            )}
                        </span>
                      )}
                  </div>

                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AllProduct;
