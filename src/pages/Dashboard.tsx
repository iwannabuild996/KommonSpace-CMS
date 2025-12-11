import { useEffect, useState } from 'react';
import { getUsers, getSubscriptions } from '../services/api'; // Types will be fixed
import { useToast } from '../hooks/useToast';
import CreateUserModal from '../components/CreateUserModal';
import CreateSubscriptionForm from '../components/CreateSubscriptionForm';

export default function Dashboard() {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);

    // Stats State
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        expiredSubscriptions: 0,
        totalRevenue: 0,
        statusCounts: {} as Record<string, number>,
    });

    // Modal State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [users, subscriptions] = await Promise.all([
                getUsers(),
                getSubscriptions(),
            ]);

            processStats(users || [], subscriptions || []);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load dashboard data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const processStats = (users: any[], subscriptions: any[]) => {
        const today = new Date().toISOString().split('T')[0];
        let active = 0;
        let expired = 0;
        let revenue = 0;
        const statusCounts: Record<string, number> = {};

        subscriptions.forEach((sub) => {
            // Active vs Expired
            if (sub.expiry_date && sub.expiry_date >= today) {
                active++;
            } else if (sub.expiry_date && sub.expiry_date < today) {
                expired++;
            }

            // Revenue
            if (sub.purchase_amount) {
                revenue += Number(sub.purchase_amount);
            }

            // Status Counts
            const status = sub.status || 'Unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        setStats({
            totalUsers: users.length,
            totalSubscriptions: subscriptions.length,
            activeSubscriptions: active,
            expiredSubscriptions: expired,
            totalRevenue: revenue,
            statusCounts,
        });
    };

    const StatCard = ({ title, value, subtext }: { title: string; value: string | number; subtext?: string }) => (
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">{title}</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{value}</dd>
            {subtext && <dd className="mt-1 text-sm text-gray-500">{subtext}</dd>}
        </div>
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="md:flex md:items-center md:justify-between mb-8">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Dashboard
                    </h2>
                </div>
                <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
                    <button
                        type="button"
                        onClick={() => setIsUserModalOpen(true)}
                        className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                        Create User
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsSubscriptionModalOpen(true)}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        Create Subscription
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading stats...</div>
            ) : (
                <div className="space-y-8">
                    {/* Main Stats Grid */}
                    <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total Users" value={stats.totalUsers} />
                        <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} />
                        <StatCard title="Active Subscriptions" value={stats.activeSubscriptions} />
                        <StatCard title="Expired" value={stats.expiredSubscriptions} />
                    </dl>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        {/* Status Breakdown */}
                        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                                <h3 className="text-base font-semibold leading-6 text-gray-900">Subscriptions by Status</h3>
                            </div>
                            <div className="px-4 py-5 sm:p-6">
                                {Object.keys(stats.statusCounts).length === 0 ? (
                                    <p className="text-gray-500">No data available.</p>
                                ) : (
                                    <ul className="divide-y divide-gray-100">
                                        {Object.entries(stats.statusCounts).map(([status, count]) => (
                                            <li key={status} className="flex justify-between py-2">
                                                <span className="text-sm font-medium text-gray-700">{status}</span>
                                                <span className="text-sm text-gray-500">{count}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                        {/*  Quick Summary / Secondary Stats can go here */}
                        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                                <h3 className="text-base font-semibold leading-6 text-gray-900">Overview</h3>
                            </div>
                            <div className="px-4 py-5 sm:p-6">
                                <dl className="divide-y divide-gray-100">
                                    <div className="flex justify-between py-2">
                                        <dt className="text-sm font-medium text-gray-500">Total Subscriptions All Time</dt>
                                        <dd className="text-sm font-semibold text-gray-900">{stats.totalSubscriptions}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CreateUserModal
                isOpen={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                onSuccess={() => {
                    fetchData();
                }}
            />

            {isSubscriptionModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsSubscriptionModalOpen(false)} />
                        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
                            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                                <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">Create New Subscription</h3>
                                <CreateSubscriptionForm
                                    onSuccess={() => {
                                        setIsSubscriptionModalOpen(false);
                                        fetchData();
                                    }}
                                    onCancel={() => setIsSubscriptionModalOpen(false)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
