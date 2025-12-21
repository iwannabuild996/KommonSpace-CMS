
import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { updateSubscriptionItem } from '../services/api';
import type { SubscriptionItem } from '../services/api';

interface EditSubscriptionItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: SubscriptionItem | null;
    onUpdate: () => void;
}

export default function EditSubscriptionItemModal({
    isOpen,
    onClose,
    item,
    onUpdate,
}: EditSubscriptionItemModalProps) {
    const [description, setDescription] = useState('');
    const [revenueNature, setRevenueNature] = useState<'TURNOVER' | 'PASSTHROUGH'>('TURNOVER');
    const [amount, setAmount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (item) {
            setDescription(item.description || '');
            setRevenueNature(item.revenue_nature);
            setAmount(item.amount);
            setError(null);
        }
    }, [item]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item) return;

        setLoading(true);
        setError(null);

        try {
            await updateSubscriptionItem(item.id, {
                description,
                revenue_nature: revenueNature,
                amount,
            });
            onUpdate();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update item');
        } finally {
            setLoading(false);
        }
    };

    if (!item) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-sm rounded bg-white p-6 shadow-xl w-full">
                    <div className="flex justify-between items-center mb-4">
                        <Dialog.Title className="text-lg font-medium">Edit Item</Dialog.Title>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Description</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                placeholder="Custom Description"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Revenue Nature</label>
                            <select
                                value={revenueNature}
                                onChange={(e) => setRevenueNature(e.target.value as 'TURNOVER' | 'PASSTHROUGH')}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            >
                                <option value="TURNOVER">Turnover</option>
                                <option value="PASSTHROUGH">Passthrough</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Amount (₹)</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>

                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
