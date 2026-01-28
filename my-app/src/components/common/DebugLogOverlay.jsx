import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/api';

/**
 * Debug Log Overlay - Hiển thị log từ backend theo thời gian thực
 * Dùng cho mục đích DEMO, không dành cho Production!
 */
const DebugLogOverlay = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState([]);
    const [isPolling, setIsPolling] = useState(false);
    const logContainerRef = useRef(null);

    // Listen for toggle event from Header
    useEffect(() => {
        const handleToggle = () => {
            setIsOpen(prev => {
                if (!prev) {
                    setIsPolling(true); // Start polling when opening
                }
                return !prev;
            });
        };
        window.addEventListener('toggle-debug-logs', handleToggle);
        return () => window.removeEventListener('toggle-debug-logs', handleToggle);
    }, []);

    // Fetch logs from backend
    const fetchLogs = async () => {
        try {
            const response = await api.get('/v1/order/debug/logs?count=50');
            if (response.data?.logs) {
                setLogs(response.data.logs);
            }
        } catch (error) {
            // Silently fail - endpoint may not exist yet
        }
    };

    // Clear logs - just reset local state (avoid 405 if backend not rebuilt)
    const clearLogs = () => {
        setLogs([]);
    };

    // Polling effect
    useEffect(() => {
        let interval;
        if (isOpen && isPolling) {
            fetchLogs();
            interval = setInterval(fetchLogs, 2000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isOpen, isPolling]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Highlight keywords in logs
    const highlightLog = (log) => {
        const keywords = {
            'CONSUMER': '#4ade80',
            'KAFKA': '#60a5fa',
            'REDIS': '#f472b6',
            'LOCK': '#fbbf24',
            'ERROR': '#ef4444',
            'SUCCESS': '#22c55e',
            'GHN': '#a78bfa',
            'ROLLBACK': '#fb923c',
            'WARM-UP': '#2dd4bf',
            'FLASH': '#f43f5e'
        };

        let highlighted = log;
        Object.entries(keywords).forEach(([keyword, color]) => {
            const regex = new RegExp(`(${keyword})`, 'gi');
            highlighted = highlighted.replace(regex, `<span style="color: ${color}; font-weight: bold;">$1</span>`);
        });

        return highlighted;
    };

    // Don't render anything when closed (button is now in Header)
    if (!isOpen) {
        return null;
    }

    return (
        <div style={{
            position: 'fixed',
            top: '70px',
            left: '20px',
            width: '550px',
            maxHeight: '450px',
            zIndex: 9999,
            background: '#1a1a2e',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            fontFamily: "'Fira Code', 'Consolas', monospace"
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                background: '#16213e',
                borderBottom: '1px solid #0f3460'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#4ade80',
                        fontSize: '13px',
                        fontWeight: 600
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            background: isPolling ? '#22c55e' : '#ef4444',
                            borderRadius: '50%',
                            animation: isPolling ? 'pulse 1s infinite' : 'none'
                        }}></span>
                        Logs
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => setIsPolling(!isPolling)}
                        style={{
                            background: isPolling ? '#22c55e' : '#64748b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            cursor: 'pointer'
                        }}
                    >
                        {isPolling ? 'Pause' : 'Play'}
                    </button>
                    <button
                        onClick={clearLogs}
                        style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            cursor: 'pointer'
                        }}
                    >
                        🗑
                    </button>
                    <button
                        onClick={() => { setIsOpen(false); setIsPolling(false); }}
                        style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            cursor: 'pointer'
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Log Content */}
            <div
                ref={logContainerRef}
                style={{
                    height: '380px',
                    overflowY: 'auto',
                    padding: '10px',
                    background: '#0a0a0f',
                    fontSize: '10px',
                    lineHeight: '1.5'
                }}
            >
                {logs.length === 0 ? (
                    <div style={{ color: '#64748b', textAlign: 'center', paddingTop: '40px' }}>
                        Waiting for logs... Perform Checkout!
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div
                            key={index}
                            style={{
                                color: '#e2e8f0',
                                marginBottom: '3px',
                                wordBreak: 'break-word'
                            }}
                            dangerouslySetInnerHTML={{ __html: highlightLog(log) }}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default DebugLogOverlay;

