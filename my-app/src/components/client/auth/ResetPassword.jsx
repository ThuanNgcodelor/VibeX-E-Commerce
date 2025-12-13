import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { updatePassword } from "../../../api/auth.js";
import "../../../assets/css/VerifyOtp.css";


export default function ResetPassword() {
    const { t } = useTranslation();
    const { state } = useLocation();
    const navigate = useNavigate();

    // Lấy email từ state hoặc sessionStorage (backup)
    const emailFromState = state?.email || "";
    const emailFromStorage = sessionStorage.getItem("resetPasswordEmail") || "";
    const email = emailFromState || emailFromStorage;

    useEffect(() => {
        // Nếu không có email, redirect về forgot password
        if (!email || email.trim() === "") {
            navigate("/forgot", { replace: true });
            return;
        }
        // Lưu email vào sessionStorage để backup
        sessionStorage.setItem("resetPasswordEmail", email);
    }, [email, navigate]);

    // Cleanup: xóa email khỏi sessionStorage khi navigate đi khỏi trang này
    useEffect(() => {
        return () => {
            // Xóa email khi component unmount (khi navigate đi)
            // Note: Điều này sẽ chạy khi navigate sang trang khác
            const currentPath = window.location.pathname;
            if (!currentPath.includes("/reset-password")) {
                sessionStorage.removeItem("resetPasswordEmail");
            }
        };
    }, []);

    const [pwd, setPwd] = useState("");
    const [pwd2, setPwd2] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [showPwd2, setShowPwd2] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");

    const strongEnough = (s) => s.length >= 8;
    const canSubmit = email && strongEnough(pwd) && pwd === pwd2 && !loading;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr(""); setMsg("");
        if (!canSubmit) return;
        try {
            setLoading(true);
            // Normalize email trước khi gửi để đảm bảo consistency với backend
            const normalizedEmail = email?.trim().toLowerCase();
            if (!normalizedEmail) {
                setErr(t('auth.resetPassword.emailRequired'));
                setLoading(false);
                return;
            }
            await updatePassword(normalizedEmail, pwd);
            setMsg(t('auth.resetPassword.success'));
            // Xóa email khỏi sessionStorage sau khi reset thành công
            sessionStorage.removeItem("resetPasswordEmail");
            setTimeout(() => navigate("/login"), 800);
        } catch (e2) {
            // Xử lý error response là object hoặc string
            const errorData = e2?.response?.data;
            let errorMsg = t('auth.resetPassword.verificationExpired');
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
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="container d-flex justify-content-center align-items-center"
            style={{ minHeight: "100dvh", paddingBlock: 16, overflowY: "auto" }}
        >
            <div className="w-100" style={{ maxWidth: 420 }}>
                {msg && <div className="alert alert-success py-2">{msg}</div>}
                {err && <div className="alert alert-danger  py-2">{err}</div>}

                <div className="position-relative d-flex justify-content-center align-items-center">
                <div className="card p-3 text-center custom-card">
                    <h6>{t('auth.resetPassword.title')}</h6>
                    <form className="mt-2 w-100 px-2" onSubmit={handleSubmit} noValidate>
                        {/* New password */}
                        <div className="mb-2 text-start">
                            <label className="form-label fw-semibold">{t('auth.resetPassword.newPasswordLabel')}</label>
                            <div className="input-group">
                                <input
                                    type={showPwd ? "text" : "password"}
                                    className={`form-control ${pwd && !strongEnough(pwd) ? "is-invalid" : ""}`}
                                    placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                                    value={pwd}
                                    onChange={(e) => setPwd(e.target.value)}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setShowPwd((s) => !s)}
                                >
                                    {showPwd ? t('auth.resetPassword.hide') : t('auth.resetPassword.show')}
                                </button>
                            </div>
                            {pwd && !strongEnough(pwd) && (
                                <div className="invalid-feedback">{t('auth.resetPassword.passwordMinLength')}</div>
                            )}
                        </div>

                        {/* Confirm */}
                        <div className="mb-2 text-start">
                            <label className="form-label fw-semibold">{t('auth.resetPassword.confirmPasswordLabel')}</label>
                            <div className="input-group">
                                <input
                                    type={showPwd2 ? "text" : "password"}
                                    className={`form-control ${pwd2 && pwd2 !== pwd ? "is-invalid" : ""}`}
                                    placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                                    value={pwd2}
                                    onChange={(e) => setPwd2(e.target.value)}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setShowPwd2((s) => !s)}
                                >
                                    {showPwd2 ? t('auth.resetPassword.hide') : t('auth.resetPassword.show')}
                                </button>
                            </div>
                            {pwd2 && pwd2 !== pwd && (
                                <div className="invalid-feedback">{t('auth.resetPassword.passwordsNotMatch')}</div>
                            )}
                        </div>

                        <div className="mt-4">
                            <button className="btn btn-danger px-0 validate" type="submit" disabled={!canSubmit}>
                                {loading ? t('auth.resetPassword.updating') : t('auth.resetPassword.updateButton')}
                            </button>
                        </div>

                    </form>
                </div>
                </div>

                {/* Không cần "Resend" ở bước này nữa vì đã verify xong */}
            </div>
        </div>
    );
}
