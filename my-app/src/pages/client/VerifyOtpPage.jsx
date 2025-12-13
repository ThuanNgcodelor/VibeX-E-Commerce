import { useLocation, useNavigate } from "react-router-dom";
import { useEffect,  useState } from "react";
import { useTranslation } from "react-i18next";
import VerifyOtp from "../../components/client/auth/VerifyOtp";
import { verifyOtp, forgotPassword } from "../../api/auth";

const maskEmail = (email) => {
    if (!email) return "";
    const [name, domain] = email.split("@");
    if (!domain) return email;
    const n = name.length;
    const head = name.slice(0, Math.min(2, n));
    const tail = name.slice(-1);
    return `${head}${"*".repeat(Math.max(1, n - 3))}${tail}@${domain}`;
};

export default function VerifyOtpPage() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const email = state?.email;

    useEffect(() => {
        if (!email) navigate("/forgot"); // thieu email thì quay lại
    }, [email, navigate]);

    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const onValidate = async (code) => {
        try {
            setErr(""); setMsg("");
            // Normalize email và trim OTP để đảm bảo consistency
            const normalizedEmail = email?.trim().toLowerCase();
            const trimmedOtp = code?.trim();
            
            if (!normalizedEmail || !trimmedOtp) {
                setErr(t('auth.verifyOtp.emailRequired'));
                return;
            }
            
            const response = await verifyOtp(normalizedEmail, trimmedOtp);
            // Nếu thành công, response sẽ có status 200 và data.ok === true
            if (response?.data?.ok === true || response?.status === 200) {
                setMsg(t('auth.verifyOtp.otpVerified'));
                // Lưu email vào sessionStorage để đảm bảo không bị mất khi navigate
                sessionStorage.setItem("resetPasswordEmail", normalizedEmail);
                // Đảm bảo email được pass đúng
                setTimeout(() => {
                    navigate("/reset-password", { state: { email: normalizedEmail } });
                }, 500); // Delay nhỏ để user thấy message
            } else {
                // Trường hợp response không đúng format (không nên xảy ra)
                setErr(t('auth.verifyOtp.invalidResponse'));
            }
        } catch (e) {
            // Xử lý error response là object hoặc string
            const errorData = e?.response?.data;
            let errorMsg = t('auth.verifyOtp.invalidOtp');
            if (errorData) {
                if (typeof errorData === 'string') {
                    errorMsg = errorData;
                } else if (errorData.message) {
                    errorMsg = errorData.message;
                } else if (errorData.error) {
                    errorMsg = errorData.error;
                }
            }
            setErr(errorMsg);
        }
    };

    const onResend = async () => {
        try {
            setErr(""); setMsg("");
            // Normalize email trước khi gửi
            const normalizedEmail = email?.trim().toLowerCase();
            if (!normalizedEmail) {
                setErr(t('auth.verifyOtp.emailRequiredResend'));
                return;
            }
            await forgotPassword(normalizedEmail);
            setMsg(t('auth.verifyOtp.newCodeSent'));
        } catch (e) {
            // Xử lý error response là object hoặc string
            const errorData = e?.response?.data;
            let errorMsg = t('auth.verifyOtp.waitBeforeResend');
            if (errorData) {
                if (typeof errorData === 'string') {
                    errorMsg = errorData;
                } else if (errorData.message) {
                    errorMsg = errorData.message;
                } else if (errorData.error) {
                    errorMsg = errorData.error;
                }
            }
            setErr(errorMsg);
        }
    };

    return (
        <div
            className="container d-flex justify-content-center align-items-center"
            style={{ minHeight: "100dvh", paddingBlock: 16, overflowY: "auto" }}
        >
            <div className="w-100" style={{ maxWidth: 420 }}>
                {msg && <div className="alert alert-success py-2">{msg}</div>}
                {err && <div className="alert alert-danger py-2">{err}</div>}

                <VerifyOtp
                    maskedPhone={maskEmail(email)}
                    onValidate={onValidate}
                    onResend={onResend}
                />
            </div>
        </div>
    );
}
