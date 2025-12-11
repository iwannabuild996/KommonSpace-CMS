import { useEffect, useState } from 'react';
import { getPlans } from '../services/api';
import type { Plan } from '../services/api';
import PlanForm from '../components/PlanForm';
import { useToast } from '../hooks/useToast';

export default function PlansPage() {
    const { addToast } = useToast();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const data = await getPlans();
            setPlans(data || []);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load plans', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const handleCreate = () => {
        setEditingPlan(null);
        setIsModalOpen(true);
    };

    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setIsModalOpen(true);
    };

    const formatFeatures = (features: any): string => {
        if (!features) return '-';
        // If it's our standard { includes: [] } format
        if (features.includes && Array.isArray(features.includes)) {
            return features.includes.join(', ');
        }
        // Fallback for random JSON
        return JSON.stringify(features).slice(0, 50) + '...';
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-semibold text-gray-900">Plans</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Manage virtual office plans, pricing, and features.
                    </p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        Create Plan
                    </button>
                </div>
            </div>

            <div className="mt-8 flow-root">
                <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Price</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Features</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Description</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                            <span className="sr-only">Edit</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-sm text-gray-500">Loading...</td>
                                        </tr>
                                    ) : plans.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-sm text-gray-500">No plans found.</td>
                                        </tr>
                                    ) : (
                                        plans.map((plan) => (
                                            <tr key={plan.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{plan.name}</td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">₹{plan.price}</td>
                                                <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate" title={formatFeatures(plan.features)}>
                                                    {formatFeatures(plan.features)}
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                                                    {plan.description || '-'}
                                                </td>
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    <button
                                                        onClick={() => handleEdit(plan)}
                                                        className="text-indigo-600 hover:text-indigo-900"
                                                    >
                                                        Edit<span className="sr-only">, {plan.name}</span>
                                                    </button>
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

            <PlanForm
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchPlans}
                initialData={editingPlan}
            />
        </div>
    );
}
