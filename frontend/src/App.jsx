import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import NEOMCanvas from '../../neom/NEOMCanvas.jsx';
import '../../neom/NEOMCanvas.css';

function EnterpriseHome() {
    return (
        <div className="app">
            <header className="topbar">
                <div>
                    <div className="eyebrow">SUPREME ENTERPRISE PLATFORM</div>
                    <h1>Enterprise Operations</h1>
                </div>

                <div className="system-status">
                    <span className="status-dot"></span>
                    SYSTEM ONLINE
                </div>
            </header>

            <main className="dashboard">
                <section className="hero">
                    <div>
                        <span className="eyebrow">GLOBAL OPERATIONS</span>

                        <h2>
                            One command layer for
                            enterprise infrastructure.
                        </h2>

                        <p>
                            Monitor infrastructure, AI operations,
                            energy systems, security and real-time
                            operational intelligence from one platform.
                        </p>

                        <Link to="/neom">
                            <button>ENTER NEOM COMMAND CENTER</button>
                        </Link>
                    </div>

                    <div className="core">
                        <div className="ring ring-1"></div>
                        <div className="ring ring-2"></div>
                        <div className="ring ring-3"></div>

                        <div className="core-center">
                            <strong>SUPREME</strong>
                            <small>LIVE CORE</small>
                        </div>
                    </div>
                </section>

                <section className="metrics">
                    <article>
                        <span>INFRASTRUCTURE</span>
                        <strong>ONLINE</strong>
                        <small>Global systems</small>
                    </article>

                    <article>
                        <span>AI AGENTS</span>
                        <strong>24</strong>
                        <small>Active operations</small>
                    </article>

                    <article>
                        <span>ENERGY</span>
                        <strong>4.0 GW</strong>
                        <small>Monitored capacity</small>
                    </article>

                    <article>
                        <span>ALERTS</span>
                        <strong>0</strong>
                        <small>Critical incidents</small>
                    </article>
                </section>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<EnterpriseHome />} />
            <Route path="/neom" element={<NEOMCanvas />} />
        </Routes>
    );
}
