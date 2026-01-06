import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import { googleLogin } from "../../api/auth.js";
import { facebookLogin } from "../../api/auth.js";

const OAuthCallback = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Toast configuration
    const Toast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
    });

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        // Determine provider from state or URL logic
        // For simplicity, we might iterate or check specific param if OAuth provider supports 'state'
        // Facebook and Google both support 'state'.
        // Let's assume we pass 'provider' in state param when initiating login.
        const state = urlParams.get("state");

        if (code) {
            let loginPromise;
            let providerName;

            // Simple logic: If we don't have state, default to Google (backward compatibility)
            // OR we can try to detect based on expected format, but state is best.
            if (state === 'facebook') {
                loginPromise = facebookLogin(code);
                providerName = 'Facebook';
            } else {
                // Default to Google or check if state is google
                loginPromise = googleLogin(code);
                providerName = 'Google';
            }

            loginPromise
                .then((data) => {
                    console.log(`${providerName} login successful:`, data);

                    Toast.fire({
                        icon: "success",
                        title: `${providerName} login successful 🎉`,
                    });

                    navigate("/");
                })
                .catch((err) => {
                    console.error(`${providerName} login error details:`, err);

                    let errorMessage = `${providerName} login failed!`;
                    if (err.response?.data?.message) {
                        errorMessage = err.response.data.message;
                    } else if (err.response?.data?.error) {
                        errorMessage = err.response.data.error;
                    } else if (err.message) {
                        errorMessage = err.message;
                    }

                    Swal.fire({
                        title: `${providerName} login failed`,
                        text: errorMessage,
                        icon: "error",
                        confirmButtonText: "Try again",
                    }).then(() => {
                        navigate("/login");
                    });
                });
        } else {
            console.error("No authorization code found in URL");
            navigate("/login");
        }
    }, [navigate, Toast, location]);

    return <div>Processing login...</div>;
};

export default OAuthCallback;
