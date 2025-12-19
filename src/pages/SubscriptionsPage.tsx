import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSubscriptions } from '../services/api';
import CreateSubscriptionForm from '../components/CreateSubscriptionForm';
import { useToast } from '../hooks/useToast';

export default function SubscriptionsPage() {
    const { addToast } = useToast();
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const data = await getSubscriptions();
            setSubscriptions(data || []);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load subscriptions', 'error');
        } finally {
            setLoading(false);
        }
    };

    const [searchQuery, setSearchQuery] = useState('');

    const filteredSubscriptions = subscriptions.filter(sub => {
        const query = searchQuery.toLowerCase();
        const userName = sub.users?.name?.toLowerCase() || '';
        const suiteNumber = sub.suite_number?.toLowerCase() || '';
        const matchesSearch = userName.includes(query) || suiteNumber.includes(query);

        // Filter by Status query param
        const statusParam = searchParams.get('status');
        let matchesStatus = true;
        if (statusParam) {
            matchesStatus = sub.status === statusParam;
        }

        // Filter by Rubber Stamp query param
        const rubberStampParam = searchParams.get('rubberStamp');
        let matchesRubberStamp = true;
        if (rubberStampParam === 'Not Available') {
            // Match logic from Dashboard: Completed AND (Not Available or Missing)
            matchesRubberStamp = sub.status === 'Completed' && (sub.rubber_stamp === 'Not Available' || !sub.rubber_stamp);
        } else if (rubberStampParam === 'Available') {
            matchesRubberStamp = sub.rubber_stamp === 'Available';
        } else if (rubberStampParam === 'With Client') {
            matchesRubberStamp = sub.rubber_stamp === 'With Client';
        }

        return matchesSearch && matchesStatus && matchesRubberStamp;
    });

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const handleFilterChange = (key: string, value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value) {
            newParams.set(key, value);
        } else {
            newParams.delete(key);
        }
        setSearchParams(newParams);
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return '-';
        // Handle YYYY-MM-DD
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateString;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-semibold text-gray-900">Subscriptions</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        View and manage active subscriptions.
                    </p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <button
                        type="button"
                        onClick={() => setIsCreateOpen(true)}
                        className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        New Subscription
                    </button>
                </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        placeholder="Search by customer name or suite number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="block rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        value={searchParams.get('status') || ''}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="Advance Received">Advance Received</option>
                        <option value="Paper Collected">Paper Collected</option>
                        <option value="Documents Ready">Documents Ready</option>
                        <option value="Signed and Uploaded">Signed and Uploaded</option>
                        <option value="Completed">Completed</option>
                    </select>
                    <select
                        className="block rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        value={searchParams.get('rubberStamp') || ''}
                        onChange={(e) => handleFilterChange('rubberStamp', e.target.value)}
                    >
                        <option value="">All Rubber Stamps</option>
                        <option value="Available">Available</option>
                        <option value="Not Available">Not Available</option>
                        <option value="With Client">With Client</option>
                    </select>
                </div>
            </div>

            <div className="mt-4 flow-root">
                <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Suite</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">User</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Plan</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Start</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Expiry</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                            <span className="sr-only">Details</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="py-4 text-center text-sm text-gray-500">Loading...</td>
                                        </tr>
                                    ) : filteredSubscriptions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-4 text-center text-sm text-gray-500">
                                                {searchQuery ? 'No matching subscriptions found.' : 'No subscriptions found.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSubscriptions.map((sub) => (
                                            <tr key={sub.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                    {sub.suite_number || '-'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {sub.users?.name || 'Unknown User'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {sub.plans?.name || 'Unknown Plan'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${sub.status === 'Completed' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                                        sub.status === 'Documents Ready' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                                                            'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                                                        }`}>
                                                        {sub.status}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatDate(sub.start_date)}</td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatDate(sub.expiry_date)}</td>
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    <a href={`/subscriptions/${sub.id}`} className="text-indigo-600 hover:text-indigo-900">
                                                        View<span className="sr-only">, {sub.id}</span>
                                                    </a>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {isCreateOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsCreateOpen(false)} />
                        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
                            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                                <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">Create New Subscription</h3>
                                <CreateSubscriptionForm
                                    onSuccess={() => {
                                        setIsCreateOpen(false);
                                        fetchSubscriptions();
                                    }}
                                    onCancel={() => setIsCreateOpen(false)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
