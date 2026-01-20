import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      background: 'white',
      borderTop: '1px solid #f0f0f0',
      marginTop: '40px'
    }}>
      {/* Main Footer Content */}
      <div className="container py-5" style={{ maxWidth: '1200px' }}>
        <div className="row g-4">
          {/* Customer Service Column */}
          <div className="col-6 col-md-4 col-lg-2">
            <h6 className="fw-semibold mb-3" style={{ color: '#222', fontSize: '14px', fontWeight: 600 }}>
              Customer Service
            </h6>
            <ul className="list-unstyled">
              <li className="mb-2">
                <Link
                  to="/contact"
                  style={{
                    color: '#666',
                    fontSize: '13px',
                    textDecoration: 'none',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ee4d2d'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                >
                  Help Center
                </Link>
              </li>
            </ul>
          </div>

          {/* Vibe Vietnam Column */}
          <div className="col-6 col-md-4 col-lg-2">
            <h6 className="fw-semibold mb-3" style={{ color: '#222', fontSize: '14px', fontWeight: 600 }}>
              Vibe Vietnam
            </h6>
            <ul className="list-unstyled">
              <li className="mb-2">
                <Link
                  to="/about"
                  style={{
                    color: '#666',
                    fontSize: '13px',
                    textDecoration: 'none',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ee4d2d'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                >
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Payment Column */}
          <div className="col-6 col-md-4 col-lg-2">
            <h6 className="fw-semibold mb-3" style={{ color: '#222', fontSize: '14px', fontWeight: 600 }}>
              Payment
            </h6>
            <div className="d-flex gap-2 flex-wrap">
              <div style={{
                width: '40px',
                height: '24px',
                background: '#f5f5f5',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 600,
                color: '#666'
              }}>
                Visa
              </div>
              <div style={{
                width: '40px',
                height: '24px',
                background: '#f5f5f5',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 600,
                color: '#666'
              }}>
                MC
              </div>
              <div style={{
                width: '40px',
                height: '24px',
                background: '#f5f5f5',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 600,
                color: '#666'
              }}>
                JCB
              </div>
            </div>
          </div>

          {/* Follow Us Column */}
          <div className="col-6 col-md-4 col-lg-2">
            <h6 className="fw-semibold mb-3" style={{ color: '#222', fontSize: '14px', fontWeight: 600 }}>
              Follow Us
            </h6>
            <div className="d-flex gap-2">
              <a
                href="https://www.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#666',
                  fontSize: '20px',
                  textDecoration: 'none',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ee4d2d'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
              >
                <i className="fa fa-facebook"></i>
              </a>
            </div>
          </div>

          {/* Download App Column */}
          <div className="col-6 col-md-4 col-lg-2">
            <h6 className="fw-semibold mb-3" style={{ color: '#222', fontSize: '14px', fontWeight: 600 }}>
              Download App
            </h6>
            <div className="d-flex gap-2 flex-column">
              <div style={{
                width: '120px',
                height: '36px',
                background: '#f5f5f5',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#666'
              }}>
                App Store
              </div>
              <div style={{
                width: '120px',
                height: '36px',
                background: '#f5f5f5',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#666'
              }}>
                Google Play
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div style={{
        background: '#f5f5f5',
        borderTop: '1px solid #f0f0f0',
        padding: '20px 0'
      }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="row align-items-center">
            <div className="col-12 text-center">
              <p className="mb-0" style={{ color: '#666', fontSize: '12px' }}>
                © {year} Vibe. All Rights Reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
