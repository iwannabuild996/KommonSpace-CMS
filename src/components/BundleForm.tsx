import React, { useState, useEffect } from 'react';
import {
    createBundle,
    updateBundle,
    getBundleItems,
    addBundleItem,
    updateBundleItem,
    removeBundleItem,
    getServices,
    getPlans,
    getConsumables
} from '../services/api';
import type { Bundle, BundleItem, Service, Plan, Consumable } from '../services/api';
import { useToast } from '../hooks/useToast';

interface BundleFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: Bundle | null;
}

const BundleForm: React.FC<BundleFormProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);

    // Bundle Data
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '',
    });

    // Items Data
    const [items, setItems] = useState<BundleItem[]>([]);
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [availableConsumables, setAvailableConsumables] = useState<Consumable[]>([]);

    // New Item State
    // New Item State / Edit State
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [newItemType, setNewItemType] = useState<'service' | 'plan' | 'consumable'>('service');
    const [newItemId, setNewItemId] = useState('');
    const [overridePrice, setOverridePrice] = useState('');

    // Initial Load
    useEffect(() => {
        const loadDependencies = async () => {
            try {
                const [servicesData, plansData, consumablesData] = await Promise.all([
                    getServices(),
                    getPlans(),
                    getConsumables()
                ]);
                setAvailableServices(servicesData || []);
                setAvailablePlans(plansData || []);
                setAvailableConsumables(consumablesData || []);
            } catch (err) {
                console.error("Failed to load dependencies", err);
            }
        };

        if (isOpen) {
            loadDependencies();
        }
    }, [isOpen]);

    // Populate Form on Edit
    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                price: initialData.price.toString(),
                description: initialData.description || '',
            });
            fetchItems(initialData.id);
        } else {
            setFormData({ name: '', price: '', description: '' });
            setItems([]);
        }
    }, [initialData, isOpen]);

    const fetchItems = async (bundleId: string) => {
        try {
            const data = await getBundleItems(bundleId);
            setItems(data || []);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load bundle items', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const priceNum = parseFloat(formData.price);
            if (isNaN(priceNum)) throw new Error('Price must be a valid number');

            const payload = {
                name: formData.name,
                description: formData.description,
                price: priceNum,
            };

            let bundleId = initialData?.id;

            if (initialData) {
                await updateBundle(initialData.id, payload);
                addToast('Bundle updated successfully', 'success');
            } else {
                const newBundle = await createBundle(payload);
                bundleId = newBundle.id;
                addToast('Bundle created successfully', 'success');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to save bundle', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async () => {
        if (!initialData) return;
        if (!newItemId) return;

        try {
            if (editingItemId) {
                // Update Logic
                await updateBundleItem(editingItemId, {
                    override_price: overridePrice ? parseFloat(overridePrice) : 0,
                });
                addToast('Item updated', 'success');
                setEditingItemId(null); // Exit edit mode
            } else {
                // Add Logic
                await addBundleItem({
                    bundle_id: initialData.id,
                    item_type: newItemType,
                    item_id: newItemId,
                    override_price: overridePrice ? parseFloat(overridePrice) : 0,
                });
                addToast('Item added', 'success');
            }

            fetchItems(initialData.id);
            // Reset fields
            setNewItemId('');
            setOverridePrice('');
            setNewItemType('service');
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to save item', 'error');
        }
    };

    const handleEditItem = (item: BundleItem) => {
        setEditingItemId(item.id);
        setNewItemType(item.item_type);
        setNewItemId(item.item_id);
        setOverridePrice(item.override_price?.toString() || '');
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setNewItemId('');
        setOverridePrice('');
        setNewItemType('service');
    };

    const handleRemoveItem = async (itemId: string) => {
        try {
            await removeBundleItem(itemId);
            addToast('Item removed', 'success');
            if (initialData) fetchItems(initialData.id);
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to remove item', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

                <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                    <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold leading-6 text-gray-900">
                                {initialData ? 'Edit Bundle' : 'Create New Bundle'}
                            </h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                <span className="sr-only">Close</span>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                                    <input
                                        type="text"
                                        id="name"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Startup Bundle"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">Total Price (₹)</label>
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
                                <div className="sm:col-span-2">
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea
                                        id="description"
                                        rows={2}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                    onClick={onClose}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Bundle'}
                                </button>
                            </div>
                        </form>

                        {/* Items Management Section - Only visible when editing existing bundle */}
                        {initialData && (
                            <div className="mt-8 border-t border-gray-200 pt-6">
                                <h4 className="text-base font-semibold leading-6 text-gray-900 mb-4">Bundle Items</h4>

                                {/* Add Item Form */}
                                <div className="space-y-3 bg-gray-50 p-3 rounded-md mb-4">
                                    {/* Type Selection */}
                                    <div className="flex gap-4">
                                        <label className="inline-flex items-center">
                                            <input
                                                type="radio"
                                                className="form-radio"
                                                name="itemType"
                                                value="service"
                                                checked={newItemType === 'service'}
                                                onChange={() => {
                                                    setNewItemType('service');
                                                    setNewItemId('');
                                                    setOverridePrice('');
                                                }}
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Service</span>
                                        </label>
                                        <label className="inline-flex items-center">
                                            <input
                                                type="radio"
                                                className="form-radio"
                                                name="itemType"
                                                value="plan"
                                                checked={newItemType === 'plan'}
                                                onChange={() => {
                                                    setNewItemType('plan');
                                                    setNewItemId('');
                                                    setOverridePrice('');
                                                }}
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Plan</span>
                                        </label>
                                        <label className="inline-flex items-center">
                                            <input
                                                type="radio"
                                                className="form-radio"
                                                name="itemType"
                                                value="consumable"
                                                checked={newItemType === 'consumable'}
                                                onChange={() => {
                                                    setNewItemType('consumable');
                                                    setNewItemId('');
                                                    setOverridePrice('');
                                                }}
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Consumable</span>
                                        </label>
                                    </div>

                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                {newItemType === 'service' ? 'Service' : (newItemType === 'consumable' ? 'Consumable' : 'Plan')}
                                            </label>
                                            <select
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                value={newItemId}
                                                onChange={(e) => {
                                                    setNewItemId(e.target.value);
                                                    // Auto-populate price based on selection
                                                    let price = 0;
                                                    if (newItemType === 'service') {
                                                        const service = availableServices.find(s => s.id === e.target.value);
                                                        if (service) price = service.price;
                                                    } else if (newItemType === 'plan') {
                                                        const plan = availablePlans.find(p => p.id === e.target.value);
                                                        if (plan && plan.price) price = plan.price;
                                                    } else if (newItemType === 'consumable') {
                                                        const consumable = availableConsumables.find(c => c.id === e.target.value);
                                                        if (consumable) price = consumable.price;
                                                    }
                                                    setOverridePrice(price.toString());
                                                }}
                                            >
                                                <option value="">Select {newItemType === 'service' ? 'Service' : (newItemType === 'consumable' ? 'Consumable' : 'Plan')}...</option>
                                                {newItemType === 'service' && availableServices.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.code}) - ₹{s.price}</option>
                                                ))}
                                                {newItemType === 'plan' && availablePlans.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>
                                                ))}
                                                {newItemType === 'consumable' && availableConsumables.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} - ₹{c.price}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-32">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Price in Bundle</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                value={overridePrice}
                                                onChange={(e) => setOverridePrice(e.target.value)}
                                                placeholder="Auto"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleAddItem}
                                                disabled={!newItemId}
                                                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                                            >
                                                {editingItemId ? 'Update' : 'Add'}
                                            </button>
                                            {editingItemId && (
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEdit}
                                                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-300">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="py-2 pl-3 text-left text-xs font-medium text-gray-500">Item</th>
                                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                                                <th scope="col" className="relative py-2 pl-3 pr-4 sm:pr-6">
                                                    <span className="sr-only">Actions</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {items.length === 0 ? (
                                                <tr><td colSpan={4} className="py-4 text-center text-sm text-gray-500">No items in this bundle.</td></tr>
                                            ) : (
                                                items.map((item) => (
                                                    <tr key={item.id}>
                                                        <td className="whitespace-nowrap py-3 pl-3 text-sm text-gray-900">
                                                            {item.item_type === 'service'
                                                                ? (item.services?.name || 'Unknown Service')
                                                                : (item.item_type === 'consumable'
                                                                    ? (item.consumables?.name || 'Unknown Consumable')
                                                                    : (item.plans?.name || 'Unknown Plan'))}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 capitalize">
                                                            {item.item_type}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                                                            ₹{item.override_price}
                                                        </td>
                                                        <td className="relative whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditItem(item)}
                                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(item.id)}
                                                                className="text-red-600 hover:text-red-900"
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {!initialData && (
                            <p className="mt-4 text-sm text-gray-500 italic text-center">
                                Save the bundle first to add items.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BundleForm;
