import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getActivePlans, getMySubscription, subscribeToPlan, cancelSubscription } from '../../api/subscription';
import { getShopOwnerInfo } from '../../api/user';
import '../../components/shop-owner/ShopOwnerLayout.css';

export default function SubscriptionPage() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [shopOwnerId, setShopOwnerId] = useState(null);
    const [plans, setPlans] = useState([]);
    const [planDuration, setPlanDuration] = useState('MONTHLY'); // 'MONTHLY' or 'YEARLY'

    // Current subscription data
    const [currentSubscription, setCurrentSubscription] = useState({
        planId: null,
        type: null,
        isActive: false,
        endDate: null,
        autoRenew: false
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Get Shop Info
            const shopInfo = await getShopOwnerInfo();
            const id = shopInfo.userId || shopInfo.id;
            setShopOwnerId(id);

            if (id) {
                // 2. Get Data in parallel
                const [plansBox, mySub] = await Promise.all([
                    getActivePlans(),
                    getMySubscription(id).catch(() => null)
                ]);

                // 3. Process Plans
                const formattedPlans = plansBox.map(p => {
                    const monthly = p.pricing?.find(pr => pr.planDuration === 'MONTHLY')?.price || 0;
                    const yearly = p.pricing?.find(pr => pr.planDuration === 'YEARLY')?.price || 0;

                    let color = '#4caf50'; // Default Green (Freeship)
                    let lightColor = '#e8f5e9';
                    let icon = 'fa-truck';

                    if (p.code === 'VOUCHER_XTRA') {
                        color = '#ff9800'; // Orange
                        lightColor = '#fff3e0';
                        icon = 'fa-ticket-alt';
                    } else if (p.code === 'BOTH') {
                        color = '#9c27b0'; // Purple
                        lightColor = '#f3e5f5';
                        icon = 'fa-star';
                    }

                    return {
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        description: p.description,
                        features: p.features?.map(f => f.featureText) || [],
                        monthlyPrice: monthly,
                        yearlyPrice: yearly,
                        icon: icon,
                        color: color,
                        lightColor: lightColor,
                        isPopular: p.code === 'BOTH',
                        serviceFeePercent: (p.commissionFreeshipRate * 100) + (p.commissionVoucherRate * 100)
                    };
                });

                // Sort by price
                setPlans(formattedPlans.sort((a, b) => a.monthlyPrice - b.monthlyPrice));

                // 4. Process Subscription
                if (mySub && mySub.isActive) {
                    setCurrentSubscription({
                        planId: plansBox.find(p => p.code === mySub.subscriptionType || p.id === mySub.planId)?.id,
                        type: mySub.subscriptionType,
                        isActive: true,
                        endDate: mySub.endDate,
                        autoRenew: false
                    });
                } else {
                    setCurrentSubscription({ isActive: false });
                }
            }
        } catch (error) {
            console.error("Error fetching subscription data", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleSubscribe = async (plan) => {
        if (loading || !shopOwnerId) return;

        if (!window.confirm(t('shopOwner.subscription.confirmSubscribe', {
            plan: plan.name,
            price: formatCurrency(planDuration === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice)
        }))) {
            return;
        }

        setLoading(true);
        try {
            await subscribeToPlan(shopOwnerId, plan.id, planDuration);
            alert(t('shopOwner.subscription.subscribeSuccess'));
            fetchData(); // Reload all data
        } catch (error) {
            alert(error.message || t('shopOwner.subscription.subscribeError'));
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm(t('shopOwner.subscription.confirmCancel', 'Are you sure you want to cancel your subscription? Benefits will end immediately.'))) {
            return;
        }

        setLoading(true);
        try {
            await cancelSubscription(shopOwnerId);
            alert(t('shopOwner.subscription.cancelSuccess', 'Subscription cancelled successfully'));
            fetchData();
        } catch (error) {
            alert(error.message || t('shopOwner.subscription.cancelError', 'Failed to cancel subscription'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>{t('shopOwner.subscription.title')}</h1>
                        <p className="text-muted">{t('shopOwner.subscription.subtitle')}</p>
                    </div>
                </div>
            </div>

            {/* Current Subscription Status */}
            {currentSubscription.isActive && (
                <div className="card mb-4 border-success">
                    <div className="card-header bg-success text-white">
                        <h5 className="mb-0">
                            <i className="fas fa-check-circle me-2"></i>
                            {t('shopOwner.subscription.currentSubscription')}
                        </h5>
                    </div>
                    <div className="card-body">
                        <div className="row align-items-center">
                            <div className="col-md-8">
                                <h6 className="fw-bold mb-2">
                                    {plans.find(p => p.code === currentSubscription.type)?.name || currentSubscription.type}
                                </h6>
                                <p className="text-muted mb-2">
                                    {t('shopOwner.subscription.activeUntil')}: {formatDate(currentSubscription.endDate)}
                                </p>
                            </div>
                            <div className="col-md-4 text-end">
                                <button
                                    className="btn btn-outline-danger"
                                    onClick={handleCancel}
                                    disabled={loading}
                                >
                                    <i className="fas fa-times me-2"></i>
                                    {t('shopOwner.subscription.cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Plan Duration Selector */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex justify-content-center gap-3">
                        <button
                            className={`btn ${planDuration === 'MONTHLY' ? 'btn-danger' : 'btn-outline-secondary'}`}
                            onClick={() => setPlanDuration('MONTHLY')}
                            style={{ minWidth: '150px' }}
                        >
                            <i className="fas fa-calendar-alt me-2"></i>
                            {t('shopOwner.subscription.monthly')}
                        </button>
                        <button
                            className={`btn ${planDuration === 'YEARLY' ? 'btn-danger' : 'btn-outline-secondary'}`}
                            onClick={() => setPlanDuration('YEARLY')}
                            style={{ minWidth: '150px' }}
                        >
                            <i className="fas fa-calendar-check me-2"></i>
                            {t('shopOwner.subscription.yearly')}
                            <span className="badge bg-success ms-2">
                                {t('shopOwner.subscription.save')}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Subscription Plans */}
            <div className="row g-4">
                {plans.length > 0 ? plans.map(plan => (
                    <div className="col-md-4" key={plan.id}>
                        <div className="card h-100 position-relative shadow-sm" style={{
                            border: currentSubscription.isActive && currentSubscription.type === plan.code
                                ? `2px solid ${plan.color}`
                                : '1px solid #eee',
                            transition: 'all 0.3s',
                            borderRadius: '12px',
                            overflow: 'hidden'
                        }}>
                            {/* Popular Badge */}
                            {plan.isPopular && (
                                <div className="position-absolute end-0 top-0 mt-3 me-3">
                                    <span className="badge rounded-pill" style={{ backgroundColor: '#f48fb1', color: '#fff' }}>
                                        {t('shopOwner.subscription.popular') || 'Popular'}
                                    </span>
                                </div>
                            )}

                            {/* Header */}
                            <div className="d-flex align-items-center justify-content-between p-4"
                                style={{ backgroundColor: plan.lightColor, minHeight: '100px' }}>
                                <i className={`fas ${plan.icon} fa-3x`} style={{ color: plan.color }}></i>
                                <h5 className="fw-bold mb-0 text-dark">{plan.name}</h5>
                            </div>

                            <div className="card-body p-4 d-flex flex-column">
                                <p className="text-muted mb-4 small">{plan.description}</p>

                                {/* Features */}
                                <div className="mb-4 flex-grow-1">
                                    <h6 className="fw-bold mb-3 small text-uppercase" style={{ letterSpacing: '0.5px' }}>{t('shopOwner.subscription.features')}</h6>
                                    <ul className="list-unstyled">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className="mb-2 small d-flex align-items-start">
                                                <i className="fas fa-check-circle me-2 mt-1" style={{ color: plan.color }}></i>
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Commission Block */}
                                <div className="bg-light p-3 rounded mb-4">
                                    <div className="text-muted small mb-1">{t('shopOwner.subscription.commissionInfo.baseCommission') || 'Commission Fee'}</div>
                                    <div className="d-flex align-items-baseline">
                                        <h2 className="fw-bold mb-0" style={{ color: plan.color }}>
                                            {plan.serviceFeePercent > 0 ? plan.serviceFeePercent : 0}%
                                        </h2>
                                    </div>
                                    <small className="text-muted d-block mt-1">
                                        {t('shopOwner.subscription.commissionInfo.paymentFee') || 'on order value'}
                                        {plan.code === 'VOUCHER_XTRA' && ' (Max 50k/item)'}
                                    </small>
                                </div>

                                {/* Price */}
                                <div className="text-center mb-4">
                                    <div className="h3 fw-bold text-danger mb-0">
                                        {formatCurrency(planDuration === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice)}
                                    </div>
                                    <div className="text-muted small">
                                        / {planDuration === 'MONTHLY' ? t('shopOwner.subscription.perMonth') : t('shopOwner.subscription.perYear')}
                                    </div>
                                </div>

                                {/* Button */}
                                <button
                                    className={`btn w-100 fw-bold py-2`}
                                    style={{
                                        backgroundColor: currentSubscription.isActive && currentSubscription.type === plan.code ? '#28a745' : '#0d6efd',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                    onClick={() => handleSubscribe(plan)}
                                    disabled={loading || (currentSubscription.isActive && currentSubscription.type === plan.code)}
                                >
                                    {currentSubscription.isActive && currentSubscription.type === plan.code
                                        ? t('shopOwner.subscription.currentPlan')
                                        : (t('shopOwner.subscription.subscribe') || 'SUBSCRIBE NOW').toUpperCase()
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="col-12 text-center py-5">
                        <p className="text-muted">No subscription plans available.</p>
                    </div>
                )}
            </div>

            {/* Commission Explanation */}
            <div className="card mt-4">
                <div className="card-header bg-light">
                    <h6 className="mb-0">
                        <i className="fas fa-info-circle me-2"></i>
                        {t('shopOwner.subscription.commissionInfo.title')}
                    </h6>
                </div>
                <div className="card-body">
                    <div className="row">
                        <div className="col-md-6">
                            <h6 className="fw-bold mb-3">{t('shopOwner.subscription.commissionInfo.baseCommission')}</h6>
                            <ul className="list-unstyled">
                                <li className="mb-2">
                                    <i className="fas fa-circle text-muted me-2" style={{ fontSize: '0.5rem' }}></i>
                                    {t('shopOwner.subscription.commissionInfo.paymentFee')}: <strong>4%</strong>
                                </li>
                                <li className="mb-2">
                                    <i className="fas fa-circle text-muted me-2" style={{ fontSize: '0.5rem' }}></i>
                                    {t('shopOwner.subscription.commissionInfo.fixedFee')}: <strong>4%</strong>
                                </li>
                            </ul>
                        </div>
                        <div className="col-md-6">
                            <h6 className="fw-bold mb-3">{t('shopOwner.subscription.commissionInfo.subscriptionFee')}</h6>
                            <p className="small text-muted">
                                {t('shopOwner.subscription.commissionInfo.contactSupport')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
