import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import shopCoinAPI from "../../../api/shopCoin/shopCoinAPI.js";
import "../../../assets/admin/css/ShopCoin.css";
import "./DailyCheckIn.css";

export default function CoinPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [coins, setCoins] = useState(0);
    const [hasCheckedIn, setHasCheckedIn] = useState(false);
    const [consecutiveDays, setConsecutiveDays] = useState(0);
    const [myMissions, setMyMissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCoinData();
    }, []);

    const fetchCoinData = async () => {
        try {
            setLoading(true);
            const coinResp = await shopCoinAPI.getMyShopCoins();
            const currentCoins = coinResp?.points ?? 0;
            setCoins(currentCoins);
            setConsecutiveDays(coinResp?.consecutiveDays ?? 0);

            const lastCheckInStr = coinResp?.lastCheckInDate;
            if (lastCheckInStr) {
                const last = new Date(lastCheckInStr).toDateString();
                if (last === new Date().toDateString()) {
                    setHasCheckedIn(true);
                }
            }

            await fetchMyMissions();
        } catch (e) {
            console.error('Failed to load coin balance', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyMissions = async () => {
        try {
            const data = await shopCoinAPI.getMyMissions();
            setMyMissions(data);
        } catch (error) {
            console.error("Failed to fetch my missions", error);
        }
    };

    const handleClaimDynamicMission = async (missionId, reward) => {
        try {
            await shopCoinAPI.claimMissionReward(missionId);
            alert(t('coins.claimSuccess', { reward }));
            fetchMyMissions();
            const coinResp = await shopCoinAPI.getMyShopCoins();
            setCoins(coinResp?.points ?? 0);
        } catch (error) {
            console.error("Claim failed", error);
            alert(error.response?.data?.message || t('coins.cannotClaimReward'));
        }
    };

    const handleDailyCheckIn = async () => {
        if (hasCheckedIn) {
            alert(t('coins.alreadyCheckedIn'));
            return;
        }

        try {
            const result = await shopCoinAPI.dailyCheckIn();
            setCoins(result.points);
            setHasCheckedIn(true);
            setConsecutiveDays(result.consecutiveDays);
            alert(t('coins.checkInSuccess', { points: result.points }));
        } catch (error) {
            console.error('Full check-in error:', error);
            const errorMessage = error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                t('coins.cannotCheckIn');
            alert(errorMessage);
        }
    };

    const handleMissionAction = (mission) => {
        if (mission.actionCode === 'VIEW_PRODUCT') {
            const startTime = localStorage.getItem('mission_view_product_start');
            if (startTime) {
                const elapsed = Date.now() - parseInt(startTime);
                if (elapsed >= 10000) {
                    shopCoinAPI.performViewProductMission()
                        .then(() => {
                            alert(t('coins.missionUpdated'));
                            fetchMyMissions();
                            localStorage.removeItem('mission_view_product_start');
                        })
                        .catch(e => alert(t('common.error') + ": " + (e.response?.data?.message || e.message)));
                    return;
                } else {
                    alert(t('coins.viewProductMore', { seconds: (10 - elapsed / 1000).toFixed(0) }));
                    return;
                }
            }
            localStorage.setItem('mission_view_product_start', Date.now());
            navigate('/shop');
        } else if (mission.actionCode === 'VIEW_CART') {
            const startTime = localStorage.getItem('mission_view_cart_start');
            if (startTime) {
                const elapsed = Date.now() - parseInt(startTime);
                if (elapsed >= 5000) {
                    shopCoinAPI.performMissionAction('VIEW_CART')
                        .then(async () => {
                            alert(t('coins.viewCartComplete'));
                            fetchMyMissions();
                            localStorage.removeItem('mission_view_cart_start');
                            const coinResp = await shopCoinAPI.getMyShopCoins();
                            setCoins(coinResp?.points ?? 0);
                        })
                        .catch(e => alert(t('common.error') + ": " + (e.response?.data?.message || e.message)));
                    return;
                } else {
                    alert(t('coins.viewCartMore', { seconds: (5 - elapsed / 1000).toFixed(0) }));
                    navigate('/cart');
                    return;
                }
            }
            localStorage.setItem('mission_view_cart_start', Date.now());
            navigate('/cart');
        } else if (mission.actionCode === 'FOLLOW_SHOP') {
            alert(t('coins.followShopHint'));
            navigate('/');
        } else if (mission.actionCode === 'REVIEW_ORDER') {
            navigate('/information/orders');
        } else {
            alert(t('coins.doMission'));
        }
    };

    if (loading) {
        return (
            <div className="text-center p-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">{t('common.loading')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="coin-tab-container">
            {/* Header */}
            <div className="coin-header">
                <div className="coin-balance-section">
                    <div className="coin-icon-wrapper">
                        <span className="coin-icon-text">S</span>
                    </div>
                    <div className="coin-balance-info">
                        <div className="d-flex align-items-baseline">
                            <span className="coin-amount">{coins}</span>
                            <div className="coin-info-text">
                                <div className="xu-title">
                                    {t('coins.currentCoins')}
                                    <i className="fa fa-question-circle" style={{ fontSize: '12px', color: '#ccc', marginLeft: '4px' }}></i>
                                </div>
                                <div className="xu-expiry">
                                    {t('coins.expiry', { coins, date: '31-01-2026' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="get-more-xu" onClick={handleDailyCheckIn}>
                    {t('coins.getMoreCoins')} <span style={{ fontSize: '18px' }}>›</span>
                </div>
            </div>

            {/* Daily Check-in */}
            <div className="p-3">
                <div className="daily-checkin-container">
                    <div className="header-text mb-3">
                        <h6 style={{ fontSize: '16px', fontWeight: 'bold' }}>{t('coins.dailyCheckin7Days')}</h6>
                        <small className="text-muted">{t('coins.dailyCheckinHint')}</small>
                    </div>
                    <div className="checkin-grid">
                        {[...Array(7)].map((_, index) => {
                            const day = index + 1;
                            let isChecked = false;
                            let isToday = false;

                            if (hasCheckedIn) {
                                if (day <= consecutiveDays) isChecked = true;
                                if (day === consecutiveDays) isToday = true;
                            } else {
                                if (day <= consecutiveDays) isChecked = true;
                                if (day === consecutiveDays + 1) isToday = true;
                            }

                            return (
                                <div key={day} className={`checkin-day-box ${isToday ? 'active' : ''} ${isChecked ? 'checked' : ''}`}>
                                    <div className="bonus-tag">+{day === 7 ? '100+' : '100'}</div>
                                    {isChecked ? (
                                        <div className="checked-icon-circle"><i className="fa fa-check"></i></div>
                                    ) : (
                                        <div className="coin-icon-circle">S</div>
                                    )}
                                    <div className={`day-label ${isToday ? 'today' : ''}`}>
                                        {isToday ? t('coins.today') : t('coins.day', { day })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <button
                        className="checkin-btn-large"
                        onClick={handleDailyCheckIn}
                        disabled={hasCheckedIn}
                    >
                        {hasCheckedIn ? t('coins.comeBackTomorrow') : t('coins.claimNow')}
                    </button>
                </div>
            </div>

            {/* Missions */}
            <div className="mission-section p-3">
                <h6 style={{ color: '#222', fontWeight: 600, marginBottom: '15px' }}>{t('coins.missionList')}</h6>

                {myMissions.length > 0 ? (
                    myMissions.map((mission) => (
                        <div key={mission.id} className="mission-item" style={{
                            background: '#fff',
                            border: '1px solid #eee',
                            borderRadius: '8px',
                            padding: '15px',
                            marginBottom: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div className="d-flex align-items-center gap-3">
                                <div style={{
                                    width: '40px', height: '40px', background: mission.completed ? '#e8f5e9' : '#fff5f0',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: mission.completed ? '#28a745' : '#ee4d2d'
                                }}>
                                    <i className={`fa ${mission.completed ? 'fa-check' : 'fa-star'}`}></i>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{mission.title}</div>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                                        {mission.description} - <span style={{ color: '#ffc107', fontWeight: 'bold' }}>{mission.rewardAmount} {t('coins.xu')}</span>
                                    </div>
                                    <div className="progress mt-1" style={{ height: '4px', maxWidth: '100px' }}>
                                        <div className="progress-bar bg-warning" role="progressbar"
                                            style={{ width: `${(mission.progress / mission.targetCount) * 100}%` }}
                                            aria-valuenow={mission.progress} aria-valuemin="0" aria-valuemax={mission.targetCount}></div>
                                    </div>
                                    <small className="text-muted">{mission.progress}/{mission.targetCount}</small>
                                </div>
                            </div>
                            <div>
                                {mission.claimed ? (
                                    <button className="btn btn-sm btn-secondary" disabled>{t('coins.claimed')}</button>
                                ) : mission.completed ? (
                                    <button
                                        onClick={() => handleClaimDynamicMission(mission.missionId, mission.rewardAmount)}
                                        className="btn btn-sm btn-success"
                                    >
                                        {t('coins.claimReward')}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleMissionAction(mission)}
                                        className="btn btn-sm btn-outline-primary"
                                    >
                                        {t('coins.doIt')}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center p-3 text-muted">{t('coins.noMissions')}</div>
                )}
            </div>
        </div>
    );
}
