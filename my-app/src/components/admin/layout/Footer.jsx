import React from 'react';

const Footer = () => {
  return (
    <footer className="sticky-footer bg-petcare py-4">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-6 text-center">
            <span className="text-muted">
              &copy; {new Date().getFullYear()} - Powered by{' '}
              <b>
                <a
                  href="https://yourbrand.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-none text-petcare"
                >
                  PetCare Team
                </a>
              </b>
              <span id="version-ruangadmin" style={{ display: 'none' }}></span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
