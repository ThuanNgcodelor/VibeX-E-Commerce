import React, { useEffect, useMemo,  useState } from "react";
import { useTranslation } from "react-i18next";
import "../../../assets/css/VerifyOtp.css";

export default function VerifyOtp({
                                      maskedPhone = "*******9897",
                                      onValidate, // (otp: string) => void
                                      onResend,   // () => void
                                      resendLabel
                                  }) {
    const { t } = useTranslation();
    const defaultResendLabel = resendLabel || t('auth.verifyOtp.resend');
    const length = 6;
    const refs = useMemo(() => Array.from({ length }, () => React.createRef()), []);
    const [values, setValues] = useState(Array(length).fill(""));

    useEffect(() => {
        refs[0]?.current?.focus();
    }, [refs]);

    const setAt = (idx, val) => {
        setValues((prev) => {
            const next = [...prev];
            next[idx] = val;
            return next;
        });
    };

    const handleKeyDown = (idx) => (e) => {
        const key = e.key;

        if (key === "Backspace") {
            if (values[idx]) {
                setAt(idx, "");
            } else if (idx > 0) {
                refs[idx - 1].current?.focus();
                setAt(idx - 1, "");
            }
            e.preventDefault();
            return;
        }

        if (key === "ArrowLeft" && idx > 0) {
            refs[idx - 1].current?.focus();
            e.preventDefault();
            return;
        }
        if (key === "ArrowRight" && idx < length - 1) {
            refs[idx + 1].current?.focus();
            e.preventDefault();
            return;
        }

        if (/^[0-9]$/.test(key)) {
            setAt(idx, key);
            if (idx < length - 1) refs[idx + 1].current?.focus();
            e.preventDefault();
            return;
        }

        // Cho phép Enter để submit nhanh
        if (key === "Enter") {
            handleValidate();
            e.preventDefault();
            return;
        }
    };

    const handlePaste = (idx) => (e) => {
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (!pasted) return;
        const chars = pasted.split("");
        const next = [...values];
        for (let i = 0; i < length - idx && i < chars.length; i++) {
            next[idx + i] = chars[i];
        }
        setValues(next);
        const last = Math.min(idx + chars.length - 1, length - 1);
        refs[last]?.current?.focus();
        e.preventDefault();
    };

    const handleChange = (idx) => (e) => {
        const v = e.target.value.replace(/\D/g, "");
        if (!v) {
            setAt(idx, "");
            return;
        }
        // Lấy ký tự cuối cùng nếu người dùng nhập nhiều
        const ch = v[v.length - 1];
        setAt(idx, ch);
        if (idx < length - 1) refs[idx + 1].current?.focus();
    };

    const handleValidate = () => {
        const code = values.join("");
        if (code.length !== length) return;
        onValidate?.(code);
    };

    const handleResend = (e) => {
        e.preventDefault();
        onResend?.();
    };

    return (
        <div className="position-relative d-flex justify-content-center align-items-center">
            <div>
                <div className="card p-2 text-center custom-card">
                    <h6>
                        {t('auth.verifyOtp.title')}
                    </h6>

                    <div>
                        <span>{t('auth.verifyOtp.codeSent')}</span> <small>{maskedPhone}</small>
                    </div>

                    <div id="otp" className="inputs d-flex flex-row justify-content-center mt-2">
                        {refs.map((ref, i) => (
                            <input
                                key={i}
                                ref={ref}
                                id={["first","second","third","fourth","fifth","sixth"][i]}
                                className="m-2 text-center form-control rounded"
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                maxLength={1}
                                value={values[i]}
                                onKeyDown={handleKeyDown(i)}
                                onPaste={handlePaste(i)}
                                onChange={handleChange(i)}
                                aria-label={`OTP digit ${i + 1}`}
                            />
                        ))}
                    </div>

                    <div className="mt-4">
                        <button className="btn btn-danger px-4 validate" onClick={handleValidate}>
                            {t('auth.verifyOtp.validateButton')}
                        </button>
                    </div>
                </div>

                <div className="card-2">
                    <div className="content d-flex justify-content-center align-items-center">
                        <span>{t('auth.verifyOtp.didntGetCode')}</span>
                        <a href="#" className="text-decoration-none ms-3" onClick={handleResend}>
                            {defaultResendLabel}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
