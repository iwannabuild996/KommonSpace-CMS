import React, { useState, useEffect } from 'react';
import { createPayment, updatePayment } from '../services/api';
import type { Payment } from '../services/api';
import { useToast } from '../hooks/useToast';

interface AddPaymentModalProps {
    subscriptionId: string;
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: Payment | null;
}

const AddPaymentModal: React.FC<AddPaymentModalProps> = ({ subscriptionId, userId, isOpen, onClose, onSuccess, initialData }) => {
    const [amount, setAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentType, setPaymentType] = useState('Bank Transfer');
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setAmount(initialData.amount.toString());
                setPaymentDate(new Date(initialData.payment_date).toISOString().split('T')[0]);
                setPaymentType(initialData.payment_type || 'Bank Transfer');
            } else {
                setAmount('');
                setPaymentDate(new Date().toISOString().split('T')[0]);
                setPaymentType('Bank Transfer');
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (initialData) {
                await updatePayment(initialData.id, {
                    amount: parseFloat(amount),
                    payment_date: paymentDate,
                    payment_type: paymentType
                });
                addToast('Payment updated successfully', 'success');
            } else {
                await createPayment({
                    subscription_id: subscriptionId,
                    user_id: userId,
                    amount: parseFloat(amount),
                    payment_date: paymentDate,
                    payment_type: paymentType
                });
                addToast('Payment added successfully', 'success');
            }

            onSuccess();
            onClose();
            if (!initialData) {
                setAmount('');
                setPaymentDate(new Date().toISOString().split('T')[0]);
                setPaymentType('Bank Transfer');
            }
        } catch (error: any) {
            console.error('Error saving payment:', error);
            addToast(error.message || 'Failed to save payment', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h2 className="text-xl font-bold mb-4">Add Payment</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                            Amount
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
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
                                className="block w-full rounded-md border-gray-300 pl-7 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="paymentType" className="block text-sm font-medium text-gray-700">
                            Payment Type
                        </label>
                        <select
                            id="paymentType"
                            name="paymentType"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={paymentType}
                            onChange={(e) => setPaymentType(e.target.value)}
                        >
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cash">Cash</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                            Payment Date
                        </label>
                        <input
                            type="date"
                            required
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : (initialData ? 'Update Payment' : 'Add Payment')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPaymentModal;
