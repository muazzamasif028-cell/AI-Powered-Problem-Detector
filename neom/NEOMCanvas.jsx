import React, { useEffect, useState } from 'react';

const defaultMetrics = [
    {
        label: 'Renewable Energy',
        value: '4.0 GW',
        status: 'ONLINE',
        detail: 'Solar + Wind'
    },
    {
        label: 'Green Hydrogen',
        value: '98.7%',
        status: 'STABLE',
        detail: 'Production efficiency'
    },
    {
        label: 'Energy Storage',
        value: '87.4%',
        status: 'READY',
        detail: 'BESS capacity'
    },
    {
        label: 'AI Operations',
        value: '24',
        status: 'ACTIVE',
        detail: 'Agents online'
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
    const [commandMode, setCommandMode] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    async function loadSystemData() {
        try {
            setLoading(true);
            setError(null);

            const [dashboardResponse, healthResponse] = await Promise.all([
                fetch('/api/dashboard'),
                fetch('/api/health')
            ]);

            if (!dashboardResponse.ok || !healthResponse.ok) {
                throw new Error('Unable to connect to SUPREME backend');
            }

            const dashboardData = await dashboardResponse.json();
            const healthData = await healthResponse.json();

            setDashboard(dashboardData);
            setHealth(healthData);
            setLastUpdated(new Date());

        } catch (err) {
            console.error('NEOM Canvas API Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadSystemData();

        const interval = setInterval(() => {
            loadSystemData();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const metrics = [
        ...defaultMetrics,
        {
            label: 'Platform Status',
            value: dashboard?.status || 'CONNECTING',
            status: health?.status || 'WAITING',
            detail: `${dashboard?.modules?.length || 0} modules registered`
        }
    ];

    return (
        <div className={`neom-canvas ${commandMode ? 'command-mode' : ''}`}>

            <header className="neom-header">
                <div>
                    <div className="neom-eyebrow">
                        SUPREME / NEOM / LIVE
                    </div>

                    <h1>NEOM Command Center</h1>

                    <p>
                        Integrated digital operations and
                        intelligence platform
                    </p>
                </div>

                <div className="header-actions">
                    <button
                        className="refresh-button"
                        onClick={loadSystemData}
                        disabled={loading}
                    >
                        {loading ? 'SYNCING...' : 'REFRESH'}
                    </button>

                    <div className="system-status">
                        <span className="status-dot" />
                        {health?.status || 'CONNECTING'}
                    </div>
                </div>
            </header>

            {error && (
                <div className="system-error">
                    BACKEND CONNECTION ERROR: {error}
                </div>
            )}

            <section className="hero-panel">

                <div className="hero-copy">
                    <span>NEOM DIGITAL OPERATIONS</span>

                    <h2>
                        One intelligent canvas
                        for an entire ecosystem.
                    </h2>

                    <p>
                        Monitor infrastructure, energy,
                        AI operations, sustainability and
                        critical systems from one command layer.
                    </p>

                    <button
                        className="command-button"
                        onClick={() => setCommandMode(!commandMode)}
                    >
                        {commandMode
                            ? 'EXIT COMMAND MODE'
                            : 'ENTER COMMAND MODE'}
                    </button>

                    {lastUpdated && (
                        <small className="last-updated">
                            LAST SYNC: {lastUpdated.toLocaleTimeString()}
                        </small>
                    )}
                </div>

                <div className="digital-core">
                    <div className="core-ring ring-one" />
                    <div className="core-ring ring-two" />
                    <div className="core-ring ring-three" />

                    <div className="core-center">
                        <strong>NEOM</strong>
                        <small>LIVE CORE</small>
                    </div>
                </div>

            </section>

            <section className="metrics-grid">

                {metrics.map((metric) => (
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
                            <span>NEOM ZONES</span>
                            <h3>Infrastructure Overview</h3>
                        </div>

                        <span className="live-label">
                            LIVE
                        </span>
                    </div>

                    <div className="zone-list">

                        {zones.map((zone) => (
                            <div
                                className="zone-row"
                                key={zone.name}
                            >
                                <div>
                                    <strong>{zone.name}</strong>
                                    <small>
                                        {zone.description}
                                    </small>
                                </div>

                                <span className="zone-status">
                                    {zone.status}
                                </span>
                            </div>
                        ))}

                    </div>
                </div>

                <div className="panel intelligence-panel">

                    <div className="panel-heading">
                        <div>
                            <span>AI INTELLIGENCE</span>
                            <h3>Command Intelligence</h3>
                        </div>
                    </div>

                    <div className="ai-orb">
                        <div />
                    </div>

                    <p>
                        AI operations layer is connected to the
                        SUPREME platform runtime and ready to
                        analyze infrastructure signals.
                    </p>

                    <div className="ai-stats">
                        <div>
                            <strong>24</strong>
                            <span>Agents</span>
                        </div>

                        <div>
                            <strong>
                                {health?.status === 'HEALTHY'
                                    ? '99.9%'
                                    : '--'}
                            </strong>
                            <span>Availability</span>
                        </div>

                        <div>
                            <strong>0</strong>
                            <span>Critical alerts</span>
                        </div>
                    </div>

                </div>

            </section>

            <section className="bottom-grid">

                <div className="mini-panel">
                    <span>PLATFORM</span>
                    <strong>
                        {dashboard?.dashboard || 'CONNECTING'}
                    </strong>
                    <small>
                        Version {dashboard?.version || '--'}
                    </small>
                </div>

                <div className="mini-panel">
                    <span>SECURITY</span>
                    <strong>PROTECTED</strong>
                    <small>
                        Organization policy enforced
                    </small>
                </div>

                <div className="mini-panel">
                    <span>BACKEND</span>
                    <strong>
                        {health?.status || 'CONNECTING'}
                    </strong>
                    <small>
                        Real-time telemetry gateway
                    </small>
                </div>

            </section>

        </div>
    );
}
