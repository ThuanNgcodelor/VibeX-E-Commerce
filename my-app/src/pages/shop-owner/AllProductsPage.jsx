import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProducts, searchProducts, deleteProduct } from '../../api/shopOwner';
import '../../components/shop-owner/ShopOwnerLayout.css';

export default function AllProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const itemsPerPage = 6;

  // Fetch products from API
  useEffect(() => {
    fetchProducts();
  }, [currentPage, searchQuery, statusFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let result;
      
      if (searchQuery.trim()) {
        result = await searchProducts(searchQuery, currentPage, itemsPerPage);
      } else {
        result = await getProducts(currentPage, itemsPerPage);
      }
      
      // Filter by status
      let filteredData = result.content || [];
      if (statusFilter !== 'all') {
        filteredData = filteredData.filter(p => (p.status || '').toUpperCase() === statusFilter);
      }
      
      setProducts(filteredData);
      setTotalPages(result.totalPages || 1);
      setTotalElements(result.totalElements || 0);
    } catch (error) {
      console.error('Error fetching products:', error);
      // Don't show alert if it's just empty data
      if (!error.message.includes('empty')) {
        alert(t('shopOwner.allProducts.failedToLoad') + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchProducts();
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('shopOwner.allProducts.deleteConfirm'))) {
      try {
        await deleteProduct(id);
        alert(t('shopOwner.allProducts.productDeleted'));
        fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert(t('shopOwner.allProducts.deleteFailed') + error.message);
      }
    }
  };

  const handleEdit = (productId) => {
    navigate(`/shop-owner/products/edit/${productId}`);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>{t('shopOwner.allProducts.title')}</h1>
      </div>

      <div className="orders-table">
            <div className="table-header">
              <div className="table-title">{t('shopOwner.allProducts.allProducts')}</div>
              <div className="table-actions">
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('shopOwner.allProducts.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  style={{width: '250px', marginRight: '10px'}}
                />
                <button
                  className="btn btn-outline-primary"
                  onClick={handleSearch}
                  style={{marginRight: '10px'}}
                >
                  <i className="fas fa-search"></i>
                </button>
                <select 
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                    fetchProducts();
                  }}
                  style={{width: '150px', marginRight: '10px'}}
                >
                  <option value="all">{t('shopOwner.allProducts.all')}</option>
                  <option value="IN_STOCK">{t('shopOwner.allProducts.inStock')}</option>
                  <option value="OUT_OF_STOCK">{t('shopOwner.allProducts.outOfStock')}</option>
                </select>
                <Link to="/shop-owner/products/add" className="btn btn-primary-shop">
                  <i className="fas fa-plus"></i> {t('shopOwner.allProducts.addProduct')}
                </Link>
              </div>
            </div>

        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>{t('shopOwner.allProducts.product')}</th>
                <th>{t('shopOwner.allProducts.price')}</th>
                <th>{t('shopOwner.allProducts.stock')}</th>
                <th>{t('shopOwner.allProducts.status')}</th>
                <th>{t('shopOwner.allProducts.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{textAlign: 'center', padding: '40px'}}>
                    <i className="fas fa-spinner fa-spin" style={{fontSize: '24px'}}></i>
                    <p style={{marginTop: '12px'}}>{t('shopOwner.allProducts.loading')}</p>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{textAlign: 'center', padding: '40px'}}>
                    <i className="fas fa-inbox" style={{fontSize: '48px', color: '#ddd', marginBottom: '12px', display: 'block'}}></i>
                    <p style={{color: '#999'}}>{t('shopOwner.allProducts.noProductsFound')}</p>
                  </td>
                </tr>
              ) : (
                products.map(product => (
                  <tr key={product.id}>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <img 
                          src={product.imageId ? `/v1/file-storage/get/${product.imageId}` : 'https://via.placeholder.com/80'}
                          alt={product.name}
                          style={{
                            width: '60px',
                            height: '60px',
                            objectFit: 'cover',
                            borderRadius: '6px'
                          }}
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/80';
                          }}
                        />
                        <div>
                          <div style={{fontWeight: '500'}}>{product.name}</div>
                          {product.categoryName && (
                            <small style={{color: '#999'}}>{product.categoryName}</small>
                          )}
                          {product.createdAt && (
                            <div>
                              <small style={{ color: '#999' }}>
                                {t('shopOwner.allProducts.created')} {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(product.createdAt))}
                              </small>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{fontWeight: '600', color: '#ee4d2d'}}>
                        {product.price?.toLocaleString()}₫
                      </div>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <small style={{color: '#999', textDecoration: 'line-through'}}>
                          {product.originalPrice.toLocaleString()}₫
                        </small>
                      )}
                    </td>
                    <td>
                      {product.sizes && product.sizes.length > 0 ? (
                        <span>{product.sizes.reduce((sum, size) => sum + (size.stock || 0), 0)}</span>
                      ) : (
                        <span>0</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${(product.status || '').toUpperCase() === 'IN_STOCK' ? 'bg-success' : 'bg-danger'}`}>
                        {(product.status || '').toUpperCase() === 'IN_STOCK' ? t('shopOwner.allProducts.inStock') : t('shopOwner.allProducts.outOfStock')}
                      </span>
                    </td>
                    <td>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button 
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleEdit(product.id)}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(product.id)}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-container">
            <div className="pagination-info">
              {t('shopOwner.allProducts.showing')} {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalElements)} {t('shopOwner.allProducts.of')} {totalElements} {t('shopOwner.allProducts.products')}
            </div>
            <nav aria-label="Page navigation">
              <ul className="pagination">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button 
                    className="page-link" 
                    onClick={() => {
                      setCurrentPage(currentPage - 1);
                      fetchProducts();
                    }}
                    disabled={currentPage === 1}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => {
                        setCurrentPage(page);
                        fetchProducts();
                      }}
                    >
                      {page}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button 
                    className="page-link" 
                    onClick={() => {
                      setCurrentPage(currentPage + 1);
                      fetchProducts();
                    }}
                    disabled={currentPage === totalPages}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
