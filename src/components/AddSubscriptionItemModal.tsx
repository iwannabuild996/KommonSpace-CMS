import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition, TransitionChild, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getPlans, getServices, getConsumables, createSubscriptionItem } from '../services/api';
import { useToast } from '../hooks/useToast';

interface AddSubscriptionItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    subscriptionId: string;
    onSuccess: () => void;
}

type ItemType = 'plan' | 'service' | 'consumable' | 'custom';

export default function AddSubscriptionItemModal({ isOpen, onClose, subscriptionId, onSuccess }: AddSubscriptionItemModalProps) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [itemType, setItemType] = useState<ItemType>('plan');
    const [options, setOptions] = useState<any[]>([]);
    const [selectedOptionId, setSelectedOptionId] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchOptions();
        }
    }, [isOpen, itemType]);

    const fetchOptions = async () => {
        // Only fetch options if not custom
        if (itemType === 'custom') {
            setOptions([]);
            return;
        }

        try {
            let data: any[] = [];
            if (itemType === 'plan') {
                data = await getPlans();
            } else if (itemType === 'service') {
                data = await getServices();
            } else if (itemType === 'consumable') {
                data = await getConsumables();
            }
            // Filter only active items if they have an active flag (assuming all fetched are active for now)
            setOptions(data);
        } catch (error) {
            console.error(error);
            addToast('Failed to load options', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload: any = {
                subscription_id: subscriptionId,
                item_type: itemType,
                amount: amount,
            };

            if (itemType === 'custom') {
                payload.description = description;
            } else {
                if (!selectedOptionId) {
                    addToast('Please select an option', 'error');
                    setLoading(false);
                    return;
                }
                // Map selection to appropriate foreign key
                if (itemType === 'plan') payload.plan_id = selectedOptionId;
                if (itemType === 'service') payload.service_id = selectedOptionId;
                if (itemType === 'consumable') payload.consumable_id = selectedOptionId;
            }

            // Map frontend item types to DB enum values
            const dbTypeMapping: Record<string, string> = {
                'plan': 'VO',
                'service': 'SERVICE',
                'consumable': 'CONSUMABLE',
                'custom': 'CONSUMABLE' // Use CONSUMABLE for custom one-off items for now
            };
            payload.item_type = dbTypeMapping[itemType];

            // Add required revenue_nature field
            payload.revenue_nature = 'TURNOVER';

            await createSubscriptionItem(payload);
            onSuccess();
            handleClose();
        } catch (error: any) {
            console.error(error);
            addToast(error.message || 'Failed to add item', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setItemType('plan');
        setOptions([]);
        setSelectedOptionId('');
        setAmount(0);
        setDescription('');
        onClose();
    };

    const handleOptionChange = (optionId: string) => {
        setSelectedOptionId(optionId);
        const option = options.find(o => o.id === optionId);
        if (option) {
            setAmount(option.price || 0); // Pre-fill price
        }
    };

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={handleClose}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </TransitionChild>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <DialogPanel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
                                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                        onClick={handleClose}
                                    >
                                        <span className="sr-only">Close</span>
                                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                    </button>
                                </div>
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                                        <DialogTitle as="h3" className="text-base font-semibold leading-6 text-gray-900">
                                            Add Subscription Item
                                        </DialogTitle>
                                        <div className="mt-2">
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label htmlFor="itemType" className="block text-sm font-medium leading-6 text-gray-900">
                                                        Item Type
                                                    </label>
                                                    <select
                                                        id="itemType"
                                                        name="itemType"
                                                        className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                        value={itemType}
                                                        onChange={(e) => {
                                                            setItemType(e.target.value as ItemType);
                                                            setSelectedOptionId('');
                                                            setAmount(0);
                                                        }}
                                                    >
                                                        <option value="plan">Plan</option>
                                                        <option value="service">Service</option>
                                                        <option value="consumable">Consumable</option>
                                                        <option value="custom">Custom</option>
                                                    </select>
                                                </div>

                                                {itemType !== 'custom' && (
                                                    <div>
                                                        <label htmlFor="option" className="block text-sm font-medium leading-6 text-gray-900">
                                                            Select {itemType.charAt(0).toUpperCase() + itemType.slice(1)}
                                                        </label>
                                                        <select
                                                            id="option"
                                                            className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                            value={selectedOptionId}
                                                            onChange={(e) => handleOptionChange(e.target.value)}
                                                        >
                                                            <option value="">Select an option</option>
                                                            {options.map((opt) => (
                                                                <option key={opt.id} value={opt.id}>
                                                                    {opt.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}

                                                {itemType === 'custom' && (
                                                    <div>
                                                        <label htmlFor="description" className="block text-sm font-medium leading-6 text-gray-900">
                                                            Description
                                                        </label>
                                                        <input
                                                            type="text"
                                                            name="description"
                                                            id="description"
                                                            required
                                                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                            value={description}
                                                            onChange={(e) => setDescription(e.target.value)}
                                                        />
                                                    </div>
                                                )}

                                                <div>
                                                    <label htmlFor="amount" className="block text-sm font-medium leading-6 text-gray-900">
                                                        Amount
                                                    </label>
                                                    <div className="relative mt-2 rounded-md shadow-sm">
                                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                            <span className="text-gray-500 sm:text-sm">₹</span>
                                                        </div>
                                                        <input
                                                            type="number"
                                                            name="amount"
                                                            id="amount"
                                                            required
                                                            min="0"
                                                            step="0.01"
                                                            className="block w-full rounded-md border-0 py-1.5 pl-7 pr-12 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                            placeholder="0.00"
                                                            value={amount}
                                                            onChange={(e) => setAmount(parseFloat(e.target.value))}
                                                        />
                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                                            <span className="text-gray-500 sm:text-sm">INR</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                                    <button
                                                        type="submit"
                                                        disabled={loading}
                                                        className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
                                                    >
                                                        {loading ? 'Adding...' : 'Add Item'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                                                        onClick={handleClose}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
