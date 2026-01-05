import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { googleLogin } from "../../api/auth.js";

const GoogleCallback = () => {
  const navigate = useNavigate();

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

    if (code) {
      googleLogin(code)
        .then((data) => {
          console.log("Google login successful:", data);
          // Token and refresh token are already saved by googleLogin in auth.js

          // Success toast
          Toast.fire({
            icon: "success",
            title: "Google login successful 🎉",
          });

          navigate("/");
        })
        .catch((err) => {
          console.error("Google login error details:", err);

          let errorMessage = "Google login failed!";
          if (err.response?.data?.message) {
            errorMessage = err.response.data.message;
          } else if (err.response?.data?.error) {
            errorMessage = err.response.data.error;
          } else if (err.message) {
            errorMessage = err.message;
          }

          // Error modal
          Swal.fire({
            title: "Google login failed",
            text: errorMessage,
            icon: "error",
            confirmButtonText: "Try again",
          }).then(() => {
            navigate("/login");
          });
        });
    } else {
      console.error("No authorization code found in URL");

      Swal.fire({
        title: "Error",
        text: "No authorization code received from Google",
        icon: "warning",
        confirmButtonText: "OK",
      }).then(() => {
        navigate("/login");
      });
    }
  }, [navigate, Toast]);

  return <div>Logging in with Google...</div>;
};

export default GoogleCallback;
