import React, { useState, useEffect } from 'react';
import { createService, updateService } from '../services/api';
import type { Service } from '../services/api';
import { useToast } from '../hooks/useToast';

interface ServiceFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: Service | null;
}

const ServiceForm: React.FC<ServiceFormProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        price: '',
        is_recurring: false,
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                code: initialData.code,
                name: initialData.name,
                price: initialData.price.toString(),
                is_recurring: initialData.is_recurring,
            });
        } else {
            setFormData({ code: '', name: '', price: '', is_recurring: false });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const priceNum = parseFloat(formData.price);
            if (isNaN(priceNum)) {
                throw new Error('Price must be a valid number');
            }

            const payload = {
                code: formData.code,
                name: formData.name,
                price: priceNum,
                is_recurring: formData.is_recurring,
            };

            if (initialData) {
                await updateService(initialData.id, payload);
                addToast('Service updated successfully', 'success');
            } else {
                await createService(payload);
                addToast('Service created successfully', 'success');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to save service', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

                <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                    <form onSubmit={handleSubmit}>
                        <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                            <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                                {initialData ? 'Edit Service' : 'Create New Service'}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="code" className="block text-sm font-medium text-gray-700">Code</label>
                                    <input
                                        type="text"
                                        id="code"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        placeholder="e.g., SRV001"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Unique identifier for the service</p>
                                </div>

                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                                    <input
                                        type="text"
                                        id="name"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price (₹)</label>
                                    <input
                                        type="number"
                                        id="price"
                                        required
                                        min="0"
                                        step="0.01"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        id="is_recurring"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={formData.is_recurring}
                                        onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                                    />
                                    <label htmlFor="is_recurring" className="ml-2 block text-sm text-gray-900">
                                        Recurring Service
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Service'}
                            </button>
                            <button
                                type="button"
                                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ServiceForm;
