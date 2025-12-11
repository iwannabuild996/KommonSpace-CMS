import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubscription, updateSubscription, getSubscriptionLogs } from '../services/api';
import type { SubscriptionStatus, RubberStampStatus } from '../services/api';
import { useToast } from '../hooks/useToast';

interface Log {
    id: string;
    created_at: string;
    new_status: string;
    old_status: string | null;
    admin_users?: { name: string };
}

export default function SubscriptionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [subscription, setSubscription] = useState<any>(null);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    // Edit State
    const [status, setStatus] = useState<SubscriptionStatus>('Advance Received');
    const [rubberStamp, setRubberStamp] = useState<RubberStampStatus>('Not Available');

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [subData, logsData] = await Promise.all([
                getSubscription(id),
                getSubscriptionLogs(id)
            ]);
            setSubscription(subData);
            setLogs(logsData as any[]); // logsData type might need adjustment

            // Initialize edit state
            if (subData) {
                setStatus(subData.status);
                setRubberStamp(subData.rubber_stamp || 'Not Available');
            }
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load subscription details', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleSave = async () => {
        if (!id) return;
        setUpdating(true);
        try {
            await updateSubscription(id, {
                status: status,
                rubber_stamp: rubberStamp
            });
            addToast('Subscription updated successfully', 'success');
            fetchData(); // Refresh data to get new log and updated state
        } catch (err: any) {
            console.error(err);
            addToast('Failed to update subscription', 'error');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!subscription) return <div className="p-8 text-center">Subscription not found</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="md:flex md:items-center md:justify-between mb-8">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Subscription Details
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">#{subscription.id}</p>
                </div>
                <div className="mt-4 flex md:ml-4 md:mt-0">
                    <button
                        type="button"
                        onClick={() => navigate('/subscriptions')}
                        className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                        Back to List
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left Column: Details & Status Control */}
                <div className="space-y-6">

                    {/* Status Control Card */}
                    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 bg-indigo-50 border-b border-indigo-100">
                            <h3 className="text-base font-semibold leading-6 text-indigo-900">Update Status</h3>
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                                <div className="sm:col-span-3">
                                    <label htmlFor="status" className="block text-sm font-medium leading-6 text-gray-900">Subscription Status</label>
                                    <div className="mt-2">
                                        <select
                                            id="status"
                                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                                        >
                                            <option value="Advance Received">Advance Received</option>
                                            <option value="Paper Collected">Paper Collected</option>
                                            <option value="Documents Ready">Documents Ready</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="sm:col-span-3">
                                    <label htmlFor="rubber_stamp" className="block text-sm font-medium leading-6 text-gray-900">Rubber Stamp</label>
                                    <div className="mt-2">
                                        <select
                                            id="rubber_stamp"
                                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                            value={rubberStamp}
                                            onChange={(e) => setRubberStamp(e.target.value as RubberStampStatus)}
                                        >
                                            <option value="Not Available">Not Available</option>
                                            <option value="Available">Available</option>
                                            <option value="With Client">With Client</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center justify-end gap-x-6">
                                <button
                                    type="submit"
                                    disabled={updating}
                                    onClick={handleSave}
                                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                                >
                                    {updating ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Details Card */}
                    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6">
                            <h3 className="text-base font-semibold leading-6 text-gray-900">Information</h3>
                            <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about the subscription and signatory.</p>
                        </div>
                        <div className="border-t border-gray-100">
                            <dl className="divide-y divide-gray-100">
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">User</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.users?.name}</dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Plan</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.plans?.name}</dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Suite Number</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.suite_number || '-'}</dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Dates</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                        <p>Purchased: {subscription.purchased_date}</p>
                                        <p>Start: {subscription.start_date}</p>
                                        <p>Expiry: {subscription.expiry_date}</p>
                                    </dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Financials</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                        <p>Amount: ₹{subscription.purchase_amount}</p>
                                        <p>Received: ₹{subscription.received_amount}</p>
                                    </dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Signatory</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                        <p className="font-semibold">{subscription.signatory_name} <span className="text-gray-500 font-normal">({subscription.signatory_designation})</span></p>
                                        <p>{subscription.signatory_type}</p>
                                        <p>{subscription.signatory_address}</p>
                                        {subscription.signatory_aadhaar && <p>Aadhaar: {subscription.signatory_aadhaar}</p>}
                                    </dd>
                                </div>
                                {subscription.signatory_type === 'company' && (
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">Company</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                            <p className="font-semibold">{subscription.company_name}</p>
                                            <p>{subscription.company_address}</p>
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </div>
                    </div>
                </div>

                {/* Right Column: Timeline */}
                <div>
                    <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                            <h3 className="text-base font-semibold leading-6 text-gray-900">Activity Timeline</h3>
                        </div>
                        <div className="p-6">
                            <div className="flow-root">
                                <ul role="list" className="-mb-8">
                                    {logs.length === 0 && <p className="text-sm text-gray-500">No logs found.</p>}
                                    {logs.map((log, logIdx) => (
                                        <li key={log.id}>
                                            <div className="relative pb-8">
                                                {logIdx !== logs.length - 1 ? (
                                                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                                                ) : null}
                                                <div className="relative flex space-x-3">
                                                    <div>
                                                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${log.new_status === 'Completed' ? 'bg-green-500' :
                                                            log.new_status === 'Documents Ready' ? 'bg-blue-500' :
                                                                'bg-gray-400'
                                                            }`}>
                                                            <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                                                            </svg>
                                                        </span>
                                                    </div>
                                                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                                        <div>
                                                            <p className="text-sm text-gray-500">
                                                                Status changed to <span className="font-medium text-gray-900">{log.new_status}</span>
                                                            </p>
                                                            {log.old_status && (
                                                                <p className="text-xs text-gray-400">Previous: {log.old_status}</p>
                                                            )}
                                                        </div>
                                                        <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                                            <time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
