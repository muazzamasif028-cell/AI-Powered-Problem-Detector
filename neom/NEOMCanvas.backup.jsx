import React from 'react';

const metrics = [
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
                    SYSTEM OPERATIONAL
                </div>
            </header>

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

                    <button className="command-button">
                        ENTER COMMAND MODE
                    </button>
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
                        AI operations layer is ready to
                        analyze infrastructure signals,
                        detect anomalies and generate
                        operational recommendations.
                    </p>

                    <div className="ai-stats">
                        <div>
                            <strong>24</strong>
                            <span>Agents</span>
                        </div>

                        <div>
                            <strong>99.9%</strong>
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
                    <span>CARBON INTELLIGENCE</span>
                    <strong>LOW IMPACT</strong>
                    <small>Real-time sustainability layer</small>
                </div>

                <div className="mini-panel">
                    <span>SECURITY</span>
                    <strong>PROTECTED</strong>
                    <small>Organization policy enforced</small>
                </div>

                <div className="mini-panel">
                    <span>REAL-TIME DATA</span>
                    <strong>CONNECTED</strong>
                    <small>Telemetry gateway ready</small>
                </div>

            </section>

        </div>
    );
}
