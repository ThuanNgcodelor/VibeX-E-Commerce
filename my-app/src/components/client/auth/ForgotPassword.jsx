import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "../../../assets/css/VerifyOtp.css";

export default function ForgotPassword({ onSendEmail, cooldownSec = 60 }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Đếm lùi cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const canSubmit = isValidEmail(email) && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError("");

    if (!isValidEmail(email)) return;

    try {
      setLoading(true);
      await onSendEmail?.(email);
      setSent(true);
      setCooldown(cooldownSec);
    } catch (err) {
      setError(err?.message || t('auth.forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  const emailError =
    touched && !isValidEmail(email) ? t('auth.forgotPassword.invalidEmail') : "";

  return (
    <div
      className="container d-flex justify-content-center align-items-center"
      style={{ minHeight: "100dvh", paddingBlock: 16, overflowY: "auto" }}
    >
      <div className="position-relative">
        <div className="card p-3 text-center custom-card">
          <h6>
            {t('auth.forgotPassword.title')} <br />
          </h6>

          <form className="mt-3 w-100 px-3" onSubmit={handleSubmit} noValidate>
            <div className="mb-2 text-start">
              <label htmlFor="fp-email" className="form-label fw-semibold">
                {t('auth.forgotPassword.emailLabel')}
              </label>
              <input
                id="fp-email"
                ref={inputRef}
                type="email"
                className={`form-control ${emailError ? "is-invalid" : ""}`}
                placeholder={t('auth.forgotPassword.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                autoComplete="email"
                aria-describedby="fp-email-help"
              />
              {emailError && (
                <div className="invalid-feedback">{emailError}</div>
              )}
              <div id="fp-email-help" className="form-text">
                {t('auth.forgotPassword.emailHelp')}
              </div>
            </div>

            {error && (
              <div className="alert alert-danger py-1 my-2" role="alert">
                {error}
              </div>
            )}

            {sent && !error && (
              <div className="form-text alert-success py-1 my-2" role="alert">
                {t('auth.forgotPassword.success', { email })}
              </div>
            )}

            <div className="mt-4">
              <button
                className="btn btn-danger px-0 validate"
                type="submit"
                disabled={!canSubmit}
              >
                {loading ? t('auth.forgotPassword.sending') : t('auth.forgotPassword.sendButton')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
