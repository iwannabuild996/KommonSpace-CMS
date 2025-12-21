
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getSubscription, getInvoices, createInvoice } from '../services/api';
import type { Subscription, Invoice, InvoiceStatus } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ChevronLeftIcon, PlusIcon, EyeIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

export default function InvoicesPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [subData, invData] = await Promise.all([
                getSubscription(id),
                getInvoices(id)
            ]);
            setSubscription(subData);
            setInvoices(invData);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvoice = async () => {
        if (!id || !subscription) return;
        setCreating(true);
        try {
            const newInvoice = await createInvoice({
                subscription_id: id,
                user_id: subscription.user_id,
                invoice_type: 'TAX_INVOICE',
                status: 'DRAFT',
                invoice_date: new Date().toISOString().split('T')[0],
                subtotal: 0,
                tax_amount: 0,
                total_amount: 0
            });
            addToast('Invoice created successfully', 'success');
            navigate(`/subscriptions/${id}/invoices/${newInvoice.id}`);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to create invoice', 'error');
        } finally {
            setCreating(false);
        }
    };

    const getStatusBadge = (status: InvoiceStatus) => {
        const styles = {
            DRAFT: 'bg-gray-100 text-gray-800',
            ISSUED: 'bg-green-100 text-green-800',
            CANCELLED: 'bg-red-100 text-red-800'
        };
        return (
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 ${styles[status]}`}>
                {status}
            </span>
        );
    };

    if (loading) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    if (!subscription) {
        return <div className="p-8 text-center text-red-600">Subscription not found</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-white shadow">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-4">
                        <Link to={`/subscriptions/${id}`} className="text-gray-500 hover:text-gray-700">
                            <ChevronLeftIcon className="h-6 w-6" />
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                            Invoices - {subscription.users?.name || 'Unknown User'}
                        </h1>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 ml-10">
                        {subscription.suite_number ? `Suite ${subscription.suite_number} • ` : ''}
                        {subscription.plans?.name || 'No Plan'}
                    </p>
                </div>
            </header>

            <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                <div className="mb-6 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">All Invoices</h2>
                    <button
                        onClick={handleCreateInvoice}
                        disabled={creating}
                        className="inline-flex items-center gap-x-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                    >
                        <PlusIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
                        {creating ? 'Creating...' : 'New Invoice'}
                    </button>
                </div>

                <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Date</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Invoice #</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Type</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                                <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Total Amount</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                                        No invoices found. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((invoice) => (
                                    <tr key={invoice.id}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">
                                            {format(new Date(invoice.created_at || new Date()), 'dd MMM yyyy')}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-indigo-600">
                                            {invoice.invoice_number || <span className="text-gray-400 italic">Draft</span>}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {invoice.invoice_type.replace('_', ' ')}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {getStatusBadge(invoice.status)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right font-mono">
                                            ₹{invoice.total_amount.toLocaleString('en-IN')}
                                        </td>
                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <Link
                                                to={`/subscriptions/${id}/invoices/${invoice.id}`}
                                                className="text-indigo-600 hover:text-indigo-900 inline-flex items-center gap-1"
                                            >
                                                View <EyeIcon className="h-4 w-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
