import React from 'react';

const TopBar = ({ toggleSidebar }) => {
  return (
    <nav className="navbar navbar-expand navbar-light bg-navbar topbar mb-4 static-top" style={{ backgroundColor: 'rgba(230, 57, 70, 0.1)' }}>

      <ul className="navbar-nav ml-auto">
        {/* Search Dropdown */}
        <li className="nav-item dropdown no-arrow">
          <a
            className="nav-link dropdown-toggle"
            href="#"
            id="searchDropdown"
            role="button"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
            style={{ color: '#1D3557' }}
          >
            <i className="fas fa-search fa-fw" style={{ color: '#1D3557' }}></i>
          </a>
          <div
            className="dropdown-menu dropdown-menu-right p-3 shadow animated--grow-in"
            aria-labelledby="searchDropdown"
          >
            <form className="navbar-search">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control bg-light border-1 small"
                  placeholder="What do you want to look for?"
                  aria-label="Search"
                  aria-describedby="basic-addon2"
                  style={{ borderColor: '#1D3557' }}
                />
                <div className="input-group-append">
                  <button className="btn btn-primary" type="button">
                    <i className="fas fa-search fa-sm" style={{ color: '#1D3557' }}></i>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </li>

        {/* Alerts Dropdown */}
        <li className="nav-item dropdown no-arrow mx-1">
          <a
            className="nav-link dropdown-toggle"
            href="#"
            id="alertsDropdown"
            role="button"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
            style={{ color: '#1D3557' }}
          >
            <i className="fas fa-bell fa-fw" style={{ color: '#1D3557' }}></i>
            <span className="badge badge-danger badge-counter">3+</span>
          </a>
          <div
            className="dropdown-list dropdown-menu dropdown-menu-right shadow animated--grow-in"
            aria-labelledby="alertsDropdown"
          >
            <h6 className="dropdown-header" style={{ color: '#1D3557' }}>Alerts Center</h6>
            <a className="dropdown-item d-flex align-items-center" href="#">
              <div className="mr-3">
                <div className="icon-circle bg-primary">
                  <i className="fas fa-file-alt text-white"></i>
                </div>
              </div>
              <div style={{ color: '#1D3557' }}>
                <div className="small text-gray-500">December 12, 2019</div>
                <span className="font-weight-bold">A new monthly report is ready to download!</span>
              </div>
            </a>
            {/* More alert items */}
          </div>
        </li>

        {/* Messages Dropdown */}
        <li className="nav-item dropdown no-arrow mx-1">
          <a
            className="nav-link dropdown-toggle"
            href="#"
            id="messagesDropdown"
            role="button"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
            style={{ color: '#1D3557' }}
          >
            <i className="fas fa-envelope fa-fw" style={{ color: '#1D3557' }}></i>
            <span className="badge badge-warning badge-counter">2</span>
          </a>
          <div
            className="dropdown-list dropdown-menu dropdown-menu-right shadow animated--grow-in"
            aria-labelledby="messagesDropdown"
          >
            <h6 className="dropdown-header" style={{ color: '#1D3557' }}>Message Center</h6>
            {/* Message items */}
          </div>
        </li>

        {/* Tasks Dropdown */}
        <li className="nav-item dropdown no-arrow mx-1">
          <a
            className="nav-link dropdown-toggle"
            href="#"
            id="tasksDropdown"
            role="button"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
            style={{ color: '#1D3557' }}
          >
            <i className="fas fa-tasks fa-fw" style={{ color: '#1D3557' }}></i>
            <span className="badge badge-success badge-counter">3</span>
          </a>
          <div
            className="dropdown-list dropdown-menu dropdown-menu-right shadow animated--grow-in"
            aria-labelledby="tasksDropdown"
          >
            <h6 className="dropdown-header" style={{ color: '#1D3557' }}>Task</h6>
            {/* Task items */}
          </div>
        </li>

        <div className="topbar-divider d-none d-sm-block"></div>

        {/* User Dropdown */}
        <li className="nav-item dropdown no-arrow">
          <a
            className="nav-link dropdown-toggle"
            href="#"
            id="userDropdown"
            role="button"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
            style={{ color: '#1D3557' }}
          >
            <img className="img-profile rounded-circle" src="/src/assets/admin/img/boy.png" style={{ maxWidth: '60px' }} alt="Profile" />
            <span className="ml-2 d-none d-lg-inline text-badge-dark small" >Maman Ketoprak</span>
          </a>
          <div className="dropdown-menu dropdown-menu-right shadow animated--grow-in" aria-labelledby="userDropdown">
            <a className="dropdown-item" href="#" style={{ color: '#1D3557' }}>
              <i className="fas fa-user fa-sm fa-fw mr-2 text-gray-400"></i>
              Profile
            </a>
            {/* More user menu items */}
          </div>
        </li>
      </ul>
    </nav>
  );
};

export default TopBar;
