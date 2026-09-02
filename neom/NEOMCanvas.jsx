import React, { useEffect, useState } from 'react';

const defaultMetrics = [
    {
        label: 'Platform Status',
        value: 'LOADING',
        status: 'CONNECTING',
        detail: 'Backend connection'
    },
    {
        label: 'AI Operations',
        value: '0',
        status: 'LOADING',
        detail: 'Platform modules'
    },
    {
        label: 'System Health',
        value: '--',
        status: 'CHECKING',
        detail: 'Runtime health'
    },
    {
        label: 'Uptime',
        value: '--',
        status: 'LOADING',
        detail: 'Server availability'
    }
];

const zones = [
    {
        name: 'THE LINE',
        status: 'OPERATIONAL',
        description: 'Urban infrastructure command'
    },
    {
        name: 'OXAGON',
        status: 'OPERATIONAL',
        description: 'Advanced industrial systems'
    },
    {
        name: 'TROJENA',
        status: 'MONITORING',
        description: 'Tourism & environmental systems'
    },
    {
        name: 'SINDALAH',
        status: 'OPERATIONAL',
        description: 'Island destination systems'
    }
];

export default function NEOMCanvas() {
    const [dashboard, setDashboard] = useState(null);
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadPlatformData() {
            try {
                setLoading(true);
                setError(null);

                const [dashboardResponse, healthResponse] =
                    await Promise.all([
                        fetch('/api/dashboard'),
                        fetch('/api/health')
                    ]);

                if (!dashboardResponse.ok) {
                    throw new Error(
                        `Dashboard API failed: ${dashboardResponse.status}`
                    );
                }

                if (!healthResponse.ok) {
                    throw new Error(
                        `Health API failed: ${healthResponse.status}`
                    );
                }

                const dashboardData = await dashboardResponse.json();
                const healthData = await healthResponse.json();

                setDashboard(dashboardData);
                setHealth(healthData);

            } catch (err) {
                console.error('Failed to load platform data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadPlatformData();
    }, []);

    const moduleCount = dashboard?.modules?.length ?? 0;

    const uptime =
        typeof health?.uptime === 'number'
            ? `${Math.floor(health.uptime)}s`
            : '--';

    const metrics = [
        {
            label: 'Platform Status',
            value: dashboard?.status ?? 'LOADING',
            status: health?.status ?? 'CONNECTING',
            detail: 'SUPREME Platform runtime'
        },
        {
            label: 'Active Modules',
            value: moduleCount,
            status: moduleCount > 0 ? 'ONLINE' : 'WAITING',
            detail: 'Registered platform modules'
        },
        {
            label: 'System Health',
            value: health?.status ?? '--',
            status: health ? 'LIVE' : 'CHECKING',
            detail: 'Real backend health API'
        },
        {
            label: 'Uptime',
            value: uptime,
            status: health ? 'ACTIVE' : 'LOADING',
            detail: 'Current server runtime'
        }
    ];

    const displayedMetrics =
        loading ? defaultMetrics : metrics;

    return (
        <div className="neom-canvas">

            <header className="neom-header">
                <div>
                    <div className="neom-eyebrow">
                        SUPREME / NEOM
                    </div>

                    <h1>NEOM Command Center</h1>

                    <p>
                        Integrated digital operations and
                        intelligence platform
                    </p>
                </div>

                <div className="system-status">
                    <span className="status-dot" />
                    {loading
                        ? 'CONNECTING'
                        : error
                            ? 'BACKEND ERROR'
                            : 'SYSTEM OPERATIONAL'}
                </div>
            </header>

            <section className="hero-panel">

                <div className="hero-copy">
                    <span>LIVE ENTERPRISE OPERATIONS</span>

                    <h2>
                        One intelligent canvas
                        for an entire ecosystem.
                    </h2>

                    <p>
                        Live SUPREME Platform data is connected
                        directly to the command interface.
                    </p>

                    <button
                        className="command-button"
                        onClick={() => window.scrollTo({
                            top: document.body.scrollHeight,
                            behavior: 'smooth'
                        })}
                    >
                        ENTER COMMAND MODE
                    </button>
                </div>

                <div className="digital-core">
                    <div className="core-ring ring-one" />
                    <div className="core-ring ring-two" />
                    <div className="core-ring ring-three" />

                    <div className="core-center">
                        <strong>
                            {health?.status === 'HEALTHY'
                                ? 'LIVE'
                                : 'NEOM'}
                        </strong>

                        <small>
                            {loading
                                ? 'CONNECTING'
                                : 'LIVE CORE'}
                        </small>
                    </div>
                </div>

            </section>

            <section className="metrics-grid">

                {displayedMetrics.map((metric) => (
                    <article
                        className="metric-card"
                        key={metric.label}
                    >
                        <div className="metric-top">
                            <span>{metric.label}</span>
                            <b>{metric.status}</b>
                        </div>

                        <strong>{metric.value}</strong>

                        <small>{metric.detail}</small>
                    </article>
                ))}

            </section>

            <section className="operations-grid">

                <div className="panel">
                    <div className="panel-heading">
                        <div>
                            <span>PLATFORM MODULES</span>
                            <h3>Infrastructure Overview</h3>
                        </div>

                        <span className="live-label">
                            {loading ? 'LOADING' : 'LIVE'}
                        </span>
                    </div>

                    <div className="zone-list">

                        {(dashboard?.modules?.length
                            ? dashboard.modules.map((module) => ({
                                name: module,
                                status: 'ONLINE',
                                description: 'SUPREME Platform module'
                            }))
                            : zones
                        ).map((item) => (
                            <div
                                className="zone-row"
                                key={item.name}
                            >
                                <div>
                                    <strong>{item.name}</strong>
                                    <small>
                                        {item.description}
                                    </small>
                                </div>

                                <span className="zone-status">
                                    {item.status}
                                </span>
                            </div>
                        ))}

                    </div>
                </div>

                <div className="panel intelligence-panel">

                    <div className="panel-heading">
                        <div>
                            <span>LIVE BACKEND</span>
                            <h3>Command Intelligence</h3>
                        </div>
                    </div>

                    <div className="ai-orb">
                        <div />
                    </div>

                    <p>
                        {error
                            ? `Backend connection error: ${error}`
                            : loading
                                ? 'Connecting to the SUPREME backend...'
                                : 'Backend health and dashboard services are connected and operational.'
                        }
                    </p>

                    <div className="ai-stats">
                        <div>
                            <strong>{moduleCount}</strong>
                            <span>Modules</span>
                        </div>

                        <div>
                            <strong>
                                {health?.status ?? '--'}
                            </strong>
                            <span>Health</span>
                        </div>

                        <div>
                            <strong>
                                {dashboard?.organization ?? 'PUBLIC'}
                            </strong>
                            <span>Organization</span>
                        </div>
                    </div>

                </div>

            </section>

            <section className="bottom-grid">

                <div className="mini-panel">
                    <span>PLATFORM VERSION</span>
                    <strong>
                        {dashboard?.version ?? '14.0.0'}
                    </strong>
                    <small>Live backend version</small>
                </div>

                <div className="mini-panel">
                    <span>INTEGRATION</span>
                    <strong>
                        {dashboard?.integration?.orchestrator?.started
                            ? 'CONNECTED'
                            : 'WAITING'}
                    </strong>
                    <small>Integration orchestrator</small>
                </div>

                <div className="mini-panel">
                    <span>BACKEND STATUS</span>
                    <strong>
                        {health?.status ?? 'OFFLINE'}
                    </strong>
                    <small>Real-time health endpoint</small>
                </div>

            </section>

        </div>
    );
}
