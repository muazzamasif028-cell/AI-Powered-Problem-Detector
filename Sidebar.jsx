// ============================================================
// 🎨 src/components/layout/Sidebar.jsx
// SUPREME Universal Sidebar Navigation
// ============================================================
import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../kernel/auth-context';
import { useKernel } from '../../hooks/useKernel';

const navigationItems = [
    {
        category: 'Platform',
        items: [
            { name: 'Overview', icon: '🏠', path: '/dashboard' },
            { name: 'Activity', icon: '📊', path: '/dashboard/activity' },
            { name: 'Quick Actions', icon: '⚡', path: '/dashboard/actions' }
            { name: 'Incident Center', icon: '🚨', path: '/incidents' }
        ]
    },
    {
        category: 'AI & Intelligence',
        items: [
            { name: 'AI Chat', icon: '🤖', path: '/ai/chat' },
            { name: 'AI Agents', icon: '🧠', path: '/ai/agents' },
            { name: 'Prompt Studio', icon: '✍️', path: '/ai/prompts' },
            { name: 'Playground', icon: '🎮', path: '/ai/playground' }
        ]
    },
    {
        category: 'Cloud Computing',
        items: [
            { name: 'Instances', icon: '🖥️', path: '/cloud/instances' },
            { name: 'Storage', icon: '💾', path: '/cloud/storage' },
            { name: 'Databases', icon: '🗄️', path: '/cloud/databases' },
            { name: 'Functions', icon: 'λ', path: '/cloud/functions' }
        ]
    },
    {
        category: 'Domains & Internet',
        items: [
            { name: 'My Domains', icon: '🌐', path: '/domain/my-domains' },
            { name: 'Search Domain', icon: '🔍', path: '/domain/search' },
            { name: 'DNS Manager', icon: '📋', path: '/domain/dns' },
            { name: 'SSL Certificates', icon: '🔒', path: '/domain/ssl' }
        ]
    },
    {
        category: 'Creator Studio',
        items: [
            { name: 'Website Builder', icon: '🎨', path: '/creator/website' },
            { name: 'App Builder', icon: '📱', path: '/creator/app' },
            { name: 'Templates', icon: '📄', path: '/creator/templates' }
        ]
    },
    {
        category: 'Developer',
        items: [
            { name: 'Repositories', icon: '📦', path: '/developer/repos' },
            { name: 'IDE', icon: '💻', path: '/developer/ide' },
            { name: 'API Manager', icon: '🔌', path: '/developer/api' },
            { name: 'CI/CD', icon: '🔄', path: '/developer/cicd' }
        ]
    },
    {
        category: 'Business',
        items: [
            { name: 'CRM', icon: '👥', path: '/business/crm' },
            { name: 'Invoicing', icon: '🧾', path: '/business/invoicing' },
            { name: 'Team', icon: '👨‍👩‍👧‍👦', path: '/business/team' }
        ]
    },
    {
        category: 'Marketplace',
        items: [
            { name: 'Browse', icon: '🛒', path: '/marketplace/browse' },
            { name: 'Installed', icon: '✅', path: '/marketplace/installed' }
        ]
    },
    {
        category: 'Billing',
        items: [
            { name: 'Overview', icon: '💰', path: '/billing/overview' },
            { name: 'Invoices', icon: '📄', path: '/billing/invoices' },
            { name: 'Payment Methods', icon: '💳', path: '/billing/payments' }
        ]
    },
    {
        category: 'Settings',
        items: [
            { name: 'Profile', icon: '👤', path: '/settings/profile' },
            { name: 'Security', icon: '🔐', path: '/settings/security' },
            { name: 'API Tokens', icon: '🔑', path: '/settings/tokens' },
            { name: 'Notifications', icon: '🔔', path: '/settings/notifications' }
        ]
    }
];

export default function Sidebar() {
    const location = useLocation();
    const { user } = useAuth();
    const { kernel } = useKernel();
    const [collapsed, setCollapsed] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState(
        navigationItems.reduce((acc, cat) => ({ ...acc, [cat.category]: true }), {})
    );

    const toggleCategory = (category) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    return (
        <aside className={`
            fixed left-0 top-0 h-screen bg-[#081426] border-r border-[#132f54]
            transition-all duration-300 z-40
            ${collapsed ? 'w-16' : 'w-64'}
        `}>
            {/* Logo */}
            <div className="h-16 flex items-center px-4 border-b border-[#132f54]">
                <span className="text-2xl">⚡</span>
                {!collapsed && (
                    <span className="ml-3 text-lg font-bold text-[#00ffff]">
                        SUPREME
                    </span>
                )}
            </div>

            {/* Navigation */}
            <nav className="overflow-y-auto h-[calc(100vh-4rem)] py-4 px-2">
                {navigationItems.map((category) => (
                    <div key={category.category} className="mb-4">
                        {!collapsed && (
                            <button
                                onClick={() => toggleCategory(category.category)}
                                className="w-full text-left px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-300"
                            >
                                {category.category}
                                <span className="float-right">
                                    {expandedCategories[category.category] ? '▾' : '▸'}
                                </span>
                            </button>
                        )}

                        {expandedCategories[category.category] && category.items.map((item) => {
                            const isActive = location.pathname === item.path;
                            
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`
                                        flex items-center px-3 py-2.5 rounded-lg mb-1
                                        transition-all duration-200 group
                                        ${isActive
                                            ? 'bg-[#17375e] text-[#00ffff] border border-[#00ffff33]'
                                            : 'text-gray-400 hover:bg-[#0f243e] hover:text-white'
                                        }
                                    `}
                                >
                                    <span className="text-lg">{item.icon}</span>
                                    {!collapsed && (
                                        <span className="ml-3 text-sm font-medium">
                                            {item.name}
                                        </span>
                                    )}
                                    {isActive && !collapsed && (
                                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00ffff]" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Collapse toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-1/2 w-6 h-6 bg-[#17375e] border border-[#00ffff33] rounded-full flex items-center justify-center text-[#00ffff] hover:bg-[#1c457a]"
            >
                {collapsed ? '→' : '←'}
            </button>

            {/* User section */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#132f54]">
                <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00ffff] to-[#38bdf8] flex items-center justify-center text-black font-bold">
                        {user?.displayName?.[0] || 'U'}
                    </div>
                    {!collapsed && (
                        <div className="ml-3 flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.displayName || 'User'}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                                {user?.primaryEmail || ''}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
