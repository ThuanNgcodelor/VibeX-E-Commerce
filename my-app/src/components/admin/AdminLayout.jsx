import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./layout/Sidebar";
import $ from "jquery";

// Expose jQuery to window for legacy scripts
if (typeof window !== 'undefined') {
    window.jQuery = $;
    window.$ = $;
}

export default function AdminLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    useEffect(() => {

        // Load admin CSS và JS
        const loadAdminAssets = async () => {
            // Load admin CSS
            const adminCSS = document.createElement('link');
            adminCSS.rel = 'stylesheet';
            adminCSS.href = '/assets/admin/css/ruang-admin.min.css';
            adminCSS.id = 'admin-css';
            document.head.appendChild(adminCSS);

            // Load FontAwesome CSS
            const fontAwesomeCSS = document.createElement('link');
            fontAwesomeCSS.rel = 'stylesheet';
            fontAwesomeCSS.href = '/assets/admin/vendor/fontawesome-free/css/all.min.css';
            fontAwesomeCSS.id = 'fontawesome-css';
            document.head.appendChild(fontAwesomeCSS);

            // Load Bootstrap CSS
            const bootstrapCSS = document.createElement('link');
            bootstrapCSS.rel = 'stylesheet';
            bootstrapCSS.href = '/assets/admin/vendor/bootstrap/css/bootstrap.min.css';
            bootstrapCSS.id = 'bootstrap-admin-css';
            document.head.appendChild(bootstrapCSS);

            // Load DataTables CSS
            const dataTablesCSS = document.createElement('link');
            dataTablesCSS.rel = 'stylesheet';
            dataTablesCSS.href = '/assets/admin/vendor/datatables/dataTables.bootstrap4.min.css';
            dataTablesCSS.id = 'datatables-css';
            document.head.appendChild(dataTablesCSS);

            // jQuery is already loaded from npm package and exposed to window
            // Just ensure it's available before loading dependent scripts
            const ensurejQuery = () => {
                return new Promise((resolve) => {
                    if (window.jQuery && window.$) {
                        resolve();
                        return;
                    }
                    // Wait a bit for jQuery to be available (should be instant since we imported it)
                    const checkInterval = setInterval(() => {
                        if (window.jQuery && window.$) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 10);
                    // Timeout after 1 second
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        resolve(); // Resolve anyway to continue
                    }, 1000);
                });
            };

            // Load scripts sequentially after jQuery
            const loadScript = (src, id) => {
                return new Promise((resolve, reject) => {
                    // Check if already loaded
                    if (document.getElementById(id)) {
                        resolve();
                        return;
                    }

                    const script = document.createElement('script');
                    script.src = src;
                    script.id = id;
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error(`Failed to load ${src}`));
                    document.body.appendChild(script);
                });
            };

            try {
                // Step 1: Ensure jQuery is available (should be instant)
                await ensurejQuery();

                // Step 2: Load jQuery Easing (depends on jQuery)
                await loadScript('/assets/admin/vendor/jquery-easing/jquery.easing.min.js', 'easing-js');

                // Step 3: Load Bootstrap JS (depends on jQuery)
                await loadScript('/assets/admin/vendor/bootstrap/js/bootstrap.bundle.min.js', 'bootstrap-js');

                // Step 4: Load DataTables JS (depends on jQuery)
                await loadScript('/assets/admin/vendor/datatables/jquery.dataTables.min.js', 'datatables-js');
                await loadScript('/assets/admin/vendor/datatables/dataTables.bootstrap4.min.js', 'datatables-bootstrap-js');

                // Step 5: Load admin JS (depends on jQuery and other libs)
                await loadScript('/assets/admin/js/ruang-admin.min.js', 'admin-js');
            } catch (error) {
                console.error('Error loading admin assets:', error);
            }
        };

        loadAdminAssets();

        // Cleanup khi component unmount
        return () => {
            const assetsToRemove = [
                'admin-css', 'fontawesome-css', 'bootstrap-admin-css', 'datatables-css',
                'bootstrap-js', 'easing-js', 'admin-js',
                'datatables-js', 'datatables-bootstrap-js'
            ];

            assetsToRemove.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.remove();
                }
            });
        };
    }, []);

    return (
        <div id="page-top" style={{ margin: 0, padding: 0 }}>
            <div id="wrapper" style={{ display: 'flex', minHeight: '100vh' }}>
                <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
                <div id="content-wrapper" className="d-flex flex-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                    <div id="content" style={{ flex: 1, padding: '0' }}>
                        <Outlet />
                    </div>
                </div>
            </div>

            {/* Scroll to top */}
            <a className="scroll-to-top rounded" href="#page-top">
                <i className="fas fa-angle-up"></i>
            </a>

            {/* Modal Logout */}
            <div className="modal fade" id="logoutModal" tabIndex="-1" role="dialog" aria-labelledby="exampleModalLabelLogout"
                aria-hidden="true">
                <div className="modal-dialog" role="document">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="exampleModalLabelLogout">Ohh No!</h5>
                            <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to logout?</p>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-primary" data-dismiss="modal">Cancel</button>
                            <a href="/login" className="btn btn-primary">Logout</a>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


