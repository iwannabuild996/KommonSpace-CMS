import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition, TransitionChild, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getServices, createSubscriptionService } from '../services/api';
import { useToast } from '../hooks/useToast';

interface AddSubscriptionServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    subscriptionId: string;
    onSuccess: () => void;
}

export default function AddSubscriptionServiceModal({ isOpen, onClose, subscriptionId, onSuccess }: AddSubscriptionServiceModalProps) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchServices();
        }
    }, [isOpen]);

    const fetchServices = async () => {
        try {
            const data = await getServices();
            setServices(data);
        } catch (error) {
            console.error(error);
            addToast('Failed to load services', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedServiceId) {
            addToast('Please select a service', 'error');
            return;
        }

        setLoading(true);

        try {
            await createSubscriptionService({
                subscription_id: subscriptionId,
                service_id: selectedServiceId,
                // Status will be handled by DB default or trigger if set up, or could default to 'active' or 'pending' depending on logic.
                // Assuming creation triggers default status.
            });
            onSuccess();
            handleClose();
        } catch (error: any) {
            console.error(error);
            addToast(error.message || 'Failed to add service', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedServiceId('');
        onClose();
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
                                            Add Active Service
                                        </DialogTitle>
                                        <div className="mt-2">
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label htmlFor="service" className="block text-sm font-medium leading-6 text-gray-900">
                                                        Select Service
                                                    </label>
                                                    <select
                                                        id="service"
                                                        className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                                        value={selectedServiceId}
                                                        onChange={(e) => setSelectedServiceId(e.target.value)}
                                                    >
                                                        <option value="">Select a service</option>
                                                        {services.map((service) => (
                                                            <option key={service.id} value={service.id}>
                                                                {service.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                                    <button
                                                        type="submit"
                                                        disabled={loading}
                                                        className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
                                                    >
                                                        {loading ? 'Add Service' : 'Add Service'}
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
