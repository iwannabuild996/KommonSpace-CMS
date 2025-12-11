import React, { useState, useEffect } from 'react';
import { createPlan, updatePlan } from '../services/api';
import type { Plan } from '../services/api';
import { useToast } from '../hooks/useToast';

interface PlanFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: Plan | null;
}

const PlanForm: React.FC<PlanFormProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        features: '', // Stored as string, parsed to JSON on submit
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                description: initialData.description || '',
                price: initialData.price ? initialData.price.toString() : '',
                features: initialData.features ? JSON.stringify(initialData.features, null, 2) : '',
            });
        } else {
            setFormData({ name: '', description: '', price: '', features: '' });
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

            let featuresJson = {};
            if (formData.features.trim()) {
                try {
                    featuresJson = JSON.parse(formData.features);
                } catch {
                    // Fallback: treat as comma-separated list if not valid JSON
                    // E.g. "feat1, feat2" -> { includes: ["feat1", "feat2"] }
                    const list = formData.features.split(',').map(s => s.trim()).filter(Boolean);
                    featuresJson = { includes: list };
                }
            }

            const payload = {
                name: formData.name,
                description: formData.description,
                price: priceNum,
                features: featuresJson,
                status: true // Default to active
            };

            if (initialData) {
                await updatePlan(initialData.id, payload);
                addToast('Plan updated successfully', 'success');
            } else {
                await createPlan(payload);
                addToast('Plan created successfully', 'success');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to save plan', 'error');
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
                                {initialData ? 'Edit Plan' : 'Create New Plan'}
                            </h3>

                            <div className="space-y-4">
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
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea
                                        id="description"
                                        rows={2}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

                                <div>
                                    <label htmlFor="features" className="block text-sm font-medium text-gray-700">
                                        Features (JSON or comma-separated)
                                    </label>
                                    <textarea
                                        id="features"
                                        rows={4}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border font-mono text-xs"
                                        placeholder='{"includes": ["feature1", "feature2"]}'
                                        value={formData.features}
                                        onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Enter valid JSON or a simple list like: "WiFi, Coffee, Desk"
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Plan'}
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

export default PlanForm;
