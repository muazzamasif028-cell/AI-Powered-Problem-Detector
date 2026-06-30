// ============================================================
// 🎨 src/pages/dashboard/OverviewPage.jsx
// SUPREME Universal Dashboard Overview
// ============================================================
import { useState, useEffect } from 'react';
import { api } from '../../kernel/api-client';
import { useAuth } from '../../kernel/auth-context';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';

export default function OverviewPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const [dashboardRes, activityRes] = await Promise.all([
                api.analytics.getDashboard(),
                api.analytics.getMetrics('24h')
            ]);
            
            setStats(dashboardRes.data);
            setRecentActivity(activityRes.data?.recent || []);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        { name: 'New AI Chat', icon: '🤖', path: '/ai/chat', color: 'from-purple-500 to-blue-500' },
        { name: 'Deploy Website', icon: '🚀', path: '/creator/website', color: 'from-green-500 to-teal-500' },
        { name: 'Register Domain', icon: '🌐', path: '/domain/search', color: 'from-orange-500 to-red-500' },
        { name: 'Create Instance', icon: '🖥️', path: '/cloud/instances', color: 'from-blue-500 to-cyan-500' },
        { name: 'New Agent', icon: '🧠', path: '/ai/agents', color: 'from-pink-500 to-purple-500' },
        { name: 'Upload File', icon: '📤', path: '/cloud/storage', color: 'from-yellow-500 to-orange-500' }
    ];

    if (loading) {
        return (
            <div className="p-8">
                <Skeleton className="h-8 w-64 mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Welcome Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">
                    Welcome back, {user?.displayName || 'User'} 👋
                </h1>
                <p className="text-gray-400 mt-2">
                    Here's what's happening across your SUPREME platform.
                </p>
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {quickActions.map((action) => (
                        <button
                            key={action.name}
                            onClick={() => window.location.href = action.path}
                            className={`
                                p-4 rounded-xl bg-gradient-to-br ${action.color}
                                hover:scale-105 transition-transform duration-200
                                text-white font-medium text-sm shadow-lg
                            `}
                        >
                            <span className="text-2xl block mb-2">{action.icon}</span>
                            {action.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="bg-[#0a1626] border-[#142e4f]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Active Domains</p>
                            <p className="text-3xl font-bold text-white mt-1">
                                {stats?.domains || 0}
                            </p>
                        </div>
                        <span className="text-3xl">🌐</span>
                    </div>
                    <div className="mt-4 text-sm text-green-400">
                        ↑ {stats?.domainGrowth || 0}% from last month
                    </div>
                </Card>

                <Card className="bg-[#0a1626] border-[#142e4f]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">AI Requests</p>
                            <p className="text-3xl font-bold text-white mt-1">
                                {stats?.aiRequests?.toLocaleString() || 0}
                            </p>
                        </div>
                        <span className="text-3xl">🤖</span>
                    </div>
                    <div className="mt-4 text-sm text-green-400">
                        ↑ {stats?.aiGrowth || 0}% from last month
                    </div>
                </Card>

                <Card className="bg-[#0a1626] border-[#142e4f]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Cloud Resources</p>
                            <p className="text-3xl font-bold text-white mt-1">
                                {stats?.cloudResources || 0}
                            </p>
                        </div>
                        <span className="text-3xl">☁️</span>
                    </div>
                    <div className="mt-4 text-sm text-gray-400">
                        {stats?.cloudStatus || 'All operational'}
                    </div>
                </Card>

                <Card className="bg-[#0a1626] border-[#142e4f]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Monthly Spend</p>
                            <p className="text-3xl font-bold text-white mt-1">
                                ${stats?.monthlySpend || 0}
                            </p>
                        </div>
                        <span className="text-3xl">💰</span>
                    </div>
                    <div className="mt-4 text-sm text-blue-400">
                        Next invoice: {stats?.nextInvoice || 'N/A'}
                    </div>
                </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-[#0a1626] border-[#142e4f]">
                    <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                        {recentActivity.slice(0, 5).map((activity, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-[#070e1a]">
                                <span className="text-xl">{activity.icon || '📌'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{activity.message}</p>
                                    <p className="text-xs text-gray-400">{activity.timestamp}</p>
                                </div>
                                <Badge color={activity.status === 'success' ? 'green' : 'yellow'}>
                                    {activity.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="bg-[#0a1626] border-[#142e4f]">
                    <h3 className="text-lg font-semibold text-white mb-4">System Status</h3>
                    <div className="space-y-3">
                        {[
                            { name: 'AI Engine', status: 'operational' },
                            { name: 'Cloud Infrastructure', status: 'operational' },
                            { name: 'Domain Services', status: 'operational' },
                            { name: 'Billing System', status: 'operational' },
                            { name: 'API Gateway', status: 'operational' },
                            { name: 'Marketplace', status: 'operational' }
                        ].map((service) => (
                            <div key={service.name} className="flex items-center justify-between p-3 rounded-lg bg-[#070e1a]">
                                <span className="text-sm text-white">{service.name}</span>
                                <Badge color="green">
                                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block mr-1" />
                                    {service.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
