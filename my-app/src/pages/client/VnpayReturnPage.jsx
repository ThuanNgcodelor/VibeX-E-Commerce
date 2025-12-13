import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Swal from "sweetalert2";
import { checkVnpayReturn } from "../../api/payment.js";

const VnpayReturnPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handleVnpayReturn = async () => {
      try {
        // Get all query parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const params = {};
        urlParams.forEach((value, key) => {
          params[key] = value;
        });

        // Call payment service to verify and process return
        const response = await checkVnpayReturn(params);
        const status = response?.status;

        if (status === "PAID") {
          // Payment successful - show success message and redirect to orders
          await Swal.fire({
            icon: "success",
            title: t('payment.success.title'),
            text: t('payment.success.text'),
            confirmButtonText: t('payment.success.button'),
            confirmButtonColor: "#ff6b35",
          });

          // Redirect to orders page (same as COD flow)
          navigate("/information/orders");
        } else {
          // Payment failed
          await Swal.fire({
            icon: "error",
            title: t('payment.failed.title'),
            text: t('payment.failed.text'),
            confirmButtonText: t('payment.failed.button'),
            confirmButtonColor: "#ff6b35",
          });

          // Redirect back to cart
          navigate("/cart");
        }
      } catch (error) {
        console.error("VNPay return error:", error);
        
        // Show error message
        await Swal.fire({
          icon: "error",
          title: t('payment.error.title'),
          text: error?.response?.data?.message || error?.message || t('payment.error.text'),
          confirmButtonText: t('payment.error.button'),
          confirmButtonColor: "#ff6b35",
        });

        // Redirect back to cart
        navigate("/cart");
      }
    };

    handleVnpayReturn();
  }, [navigate, t]);

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      minHeight: "100vh",
      flexDirection: "column",
      gap: "1rem"
    }}>
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">{t('common.processing')}</span>
      </div>
      <p>{t('common.processing')}</p>
    </div>
  );
};

export default VnpayReturnPage;

