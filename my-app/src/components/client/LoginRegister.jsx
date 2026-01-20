import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getUserRole, isAuthenticated, login, register } from "../../api/auth.js";
import { checkEmailExists } from "../../api/user.js";
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, FACEBOOK_CLIENT_ID, FACEBOOK_REDIRECT_URI } from "../../config/config.js";

export default function Auth() {
    const { t } = useTranslation();
    const [loginData, setLoginData] = useState({
        email: '',
        password: ''
    });
    const [registerData, setRegisterData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || "/";


    const handleGoogleLogin = () => {
        const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: GOOGLE_REDIRECT_URI,
            response_type: "code",
            scope: "openid email profile",
            access_type: "offline",
            prompt: "consent",
        });

        window.location.href = `${googleAuthUrl}?${params.toString()}`;
    };

    const handleFacebookLogin = () => {
        const facebookAuthUrl = "https://www.facebook.com/v19.0/dialog/oauth";
        const params = new URLSearchParams({
            client_id: FACEBOOK_CLIENT_ID,
            redirect_uri: FACEBOOK_REDIRECT_URI,
            state: "facebook",
            response_type: "code", scope: "public_profile"
        });

        window.location.href = `${facebookAuthUrl}?${params.toString()}`;
    };
    useEffect(() => {
        if (isAuthenticated()) {
            const roles = getUserRole();

            if (Array.isArray(roles)) {
                if (roles.includes("ROLE_ADMIN")) {
                    navigate("/admin");
                } else if (roles.includes("ROLE_SHOP_OWNER")) {
                    navigate("/shop-owner");
                } else if (roles.includes("ROLE_USER")) {
                    navigate("/information");
                }
            }
        }
    }, [from, navigate]);

    const handleLogin = async (e) => {
        setLoginData({
            ...loginData,
            [e.target.name]: e.target.value,
        });
    };

    const handleRegister = async (e) => {
        setRegisterData({
            ...registerData,
            [e.target.name]: e.target.value,
        });
        // Clear field error khi user thay đổi input
        if (fieldErrors[e.target.name]) {
            setFieldErrors({
                ...fieldErrors,
                [e.target.name]: ''
            });
        }
    };

    const handleForgotPassword = () => {
        navigate("/forgot");
    }

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);
        if (loginData.email === '' || loginData.password === '') {
            setError(t('auth.login.fillAllFields'));
            return;
        }

        try {
            await login(loginData);
            const role = getUserRole();
            const roles = Array.isArray(role) ? role : [role].filter(Boolean);

            if (roles.includes("ROLE_ADMIN") || roles.includes("ROLE_SHOP_OWNER")) {
                navigate("/admin");
            } else if (roles.includes("ROLE_USER")) {
                navigate("/information");
            }

        } catch (error) {
            console.log(loginData);

            setError(error.response?.data?.message || t('auth.login.loginFailed'));
        } finally {
            setLoading(false);
        }
    }

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setFieldErrors({}); // Clear field errors

        // Check empty fields
        if (!registerData.username.trim()) {
            setError(t('auth.register.usernameRequired') || 'Username is required');
            setFieldErrors(prev => ({ ...prev, username: t('auth.register.usernameRequired') || 'Username is required' }));
            return;
        }
        if (!registerData.email.trim()) {
            setError(t('auth.register.emailRequired') || 'Email is required');
            setFieldErrors(prev => ({ ...prev, email: t('auth.register.emailRequired') || 'Email is required' }));
            return;
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(registerData.email)) {
            setError(t('auth.register.invalidEmail') || 'Invalid email format');
            setFieldErrors(prev => ({ ...prev, email: t('auth.register.invalidEmail') || 'Invalid email format' }));
            return;
        }

        if (registerData.password !== registerData.confirmPassword) {
            setError(t('auth.register.passwordsNotMatch'));
            return;
        }
        if (registerData.password.length < 6) {
            setError(t('auth.register.passwordMinLength'));
            return;
        }


        setLoading(true);
        try {
            const exists = await checkEmailExists(registerData.email);
            if (exists) {
                setError(t('auth.register.emailExists'));
                return;
            }

            await register(registerData);
            setSuccess(t('auth.register.registerSuccess'));
            setRegisterData({ username: "", email: "", password: "", confirmPassword: "" });
            setFieldErrors({});
        } catch (err) {
            const responseData = err?.response?.data;

            if (responseData && typeof responseData === 'object' &&
                !responseData.message && !responseData.error &&
                (responseData.username || responseData.email || responseData.password || responseData._general)) {
                const newFieldErrors = {
                    username: responseData.username || '',
                    email: responseData.email || '',
                    password: responseData.password || ''
                };

                if (responseData._general) {
                    setError(responseData._general);
                }

                setFieldErrors(newFieldErrors);

                const errorMessages = Object.entries(responseData)
                    .filter(([key, value]) => key !== '_general' && value)
                    .map(([, value]) => value);

                if (errorMessages.length > 0 && !responseData._general) {
                    setError(errorMessages.join('. '));
                }
            } else {
                const apiMsg = responseData?.message || responseData?.error || responseData?.detail || err?.message;
                setError(apiMsg || t('auth.register.registerError'));
            }
        } finally {
            setLoading(false);
        }
    };




    return (
        <>
            <section className="login-register-area section-space">
                <div className="container">
                    {error && (
                        <div className="row">
                            <div className="col-12">
                                <div className="alert alert-danger" style={{
                                    backgroundColor: "#ffebee",
                                    color: "#c62828",
                                    padding: "15px",
                                    borderRadius: "4px",
                                    marginBottom: "20px",
                                    border: "1px solid #ffcdd2",
                                    textAlign: "center"
                                }}>
                                    <strong>{t('auth.error')}:</strong> {error}
                                </div>
                            </div>
                        </div>
                    )}

                    {success && (
                        <div className="row">
                            <div className="col-12">
                                <div className="alert alert-success" style={{
                                    backgroundColor: "#e8f5e8",
                                    color: "#2e7d32",
                                    padding: "15px",
                                    borderRadius: "4px",
                                    marginBottom: "20px",
                                    border: "1px solid #c8e6c9",
                                    textAlign: "center"
                                }}>
                                    <strong>{t('auth.success')}:</strong> {success}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="row">
                        {/*login*/}
                        <div className="col-md-5 login-register-border">
                            <div className="login-register-content">
                                <div className="login-register-title mb-30">
                                    <h2>{t('auth.login.title')}</h2>
                                    <p>{t('auth.login.subtitle')}</p>
                                </div>
                                <div className="login-register-style login-register-pr">
                                    <form action="" method="post">
                                        <div className="login-register-input">
                                            <input type="text"
                                                id="login-email"
                                                name="email"
                                                value={loginData.email}
                                                onChange={handleLogin}
                                                placeholder={t('auth.login.emailPlaceholder')}
                                            />
                                        </div>
                                        <div className="login-register-input">
                                            <input type="password"
                                                id="login-password"
                                                name="password"
                                                value={loginData.password}
                                                onChange={handleLogin}
                                                placeholder={t('auth.login.passwordPlaceholder')}
                                            />
                                            <div className="forgot">
                                                <a onClick={handleForgotPassword}>{t('auth.login.forgot')}</a>
                                            </div>
                                        </div>
                                        <div className="remember-me-btn">
                                            <input type="checkbox" />
                                            <label>{t('auth.login.rememberMe')}</label>
                                        </div>
                                        <div className="btn-register">
                                            <button className="btn-register-now"
                                                onClick={handleLoginSubmit}>{t('auth.login.button')}
                                            </button>
                                        </div>
                                        <br />
                                        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
                                            <button
                                                type="button"
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    backgroundColor: "#fff",
                                                    color: "#444",
                                                    border: "1px solid #ddd",
                                                    borderRadius: "4px",
                                                    padding: "8px 15px",
                                                    cursor: "pointer",
                                                    fontWeight: "bold",
                                                    flex: 1,
                                                    justifyContent: "center"
                                                }}
                                                onClick={handleGoogleLogin}
                                            >
                                                <img
                                                    src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png"
                                                    alt="Google"
                                                    style={{ width: 26, height: 10, marginRight: 10 }}
                                                />
                                                {t('auth.login.googleLogin')}
                                            </button>

                                            <button
                                                type="button"
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    backgroundColor: "#1877F2",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: "4px",
                                                    padding: "8px 15px",
                                                    cursor: "pointer",
                                                    fontWeight: "bold",
                                                    flex: 1,
                                                    justifyContent: "center"
                                                }}
                                                onClick={handleFacebookLogin}
                                            >
                                                Facebook
                                            </button>


                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <div className="col-md-7">
                            <div className="login-register-content login-register-pl">
                                <div className="login-register-title mb-30">
                                    <h2>{t('auth.register.title')}</h2>
                                    <p>{t('auth.register.subtitle')}</p>
                                </div>
                                <div className="login-register-style">
                                    <form method="post">
                                        <div className="login-register-input">
                                            <input type="text"
                                                id="register-username"
                                                name="username"
                                                value={registerData.username}
                                                placeholder="Username"
                                                onChange={handleRegister}
                                                style={fieldErrors.username ? { borderColor: '#c62828' } : {}}
                                            />
                                            {fieldErrors.username && (
                                                <div style={{
                                                    color: '#c62828',
                                                    fontSize: '12px',
                                                    marginTop: '5px'
                                                }}>
                                                    {fieldErrors.username}
                                                </div>
                                            )}
                                        </div>
                                        <div className="login-register-input">
                                            <input type="text"
                                                id="register-email"
                                                name="email"
                                                value={registerData.email}
                                                placeholder="E-mail address"
                                                onChange={handleRegister}
                                                style={fieldErrors.email ? { borderColor: '#c62828' } : {}}
                                            />
                                            {fieldErrors.email && (
                                                <div style={{
                                                    color: '#c62828',
                                                    fontSize: '12px',
                                                    marginTop: '5px'
                                                }}>
                                                    {fieldErrors.email}
                                                </div>
                                            )}
                                        </div>
                                        <div className="login-register-input">
                                            <input type="password"
                                                id="register-password"
                                                name="password"
                                                value={registerData.password}
                                                placeholder="Password"
                                                onChange={handleRegister}
                                                style={fieldErrors.password ? { borderColor: '#c62828' } : {}}
                                            />
                                            {fieldErrors.password && (
                                                <div style={{
                                                    color: '#c62828',
                                                    fontSize: '12px',
                                                    marginTop: '5px'
                                                }}>
                                                    {fieldErrors.password}
                                                </div>
                                            )}
                                        </div>

                                        <div className="login-register-input">
                                            <input type="password"
                                                id="register-confirmPassword"
                                                name="confirmPassword"
                                                value={registerData.confirmPassword}
                                                placeholder="Confirm Password"
                                                onChange={handleRegister}
                                            />
                                        </div>
                                        <div className="login-register-paragraph">
                                            <p>Your personal data will be used to support your experience throughout this website, to manage access to your account, and for other purposes described in our <a href="#">privacy policy.</a></p>
                                        </div>
                                        <div className="btn-register">
                                            <button className="btn-register-now" onClick={handleRegisterSubmit}>
                                                Register
                                            </button>
                                        </div>
                                    </form>
                                    <div className="register-benefits">
                                        <h3>Sign up today and you will be able to :</h3>
                                        <p>The Loke Buyer Protection has you covered from click to delivery. Sign up <br />or sign in and you will be able to:</p>
                                        <ul>
                                            <li><i className="fa fa-check-circle-o"></i> Speed your way through checkout</li>
                                            <li><i className="fa fa-check-circle-o"></i> Track your orders easily</li>
                                            <li><i className="fa fa-check-circle-o"></i> Keep a record of all your purchases</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}