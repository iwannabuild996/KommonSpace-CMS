import React, { useState, useEffect } from 'react';
import { getServiceWorkflows, createServiceWorkflow, updateServiceWorkflow } from '../services/api';
import type { ServiceWorkflow } from '../services/api';
import { useToast } from '../hooks/useToast';

interface ServiceWorkflowsModalProps {
    serviceId: string | null;
    serviceName: string;
    isOpen: boolean;
    onClose: () => void;
}

const ServiceWorkflowsModal: React.FC<ServiceWorkflowsModalProps> = ({ serviceId, serviceName, isOpen, onClose }) => {
    const { addToast } = useToast();
    const [workflows, setWorkflows] = useState<ServiceWorkflow[]>([]);
    const [loading, setLoading] = useState(false);

    // View State: 'list' or 'form'
    const [view, setView] = useState<'list' | 'form'>('list');

    // Editing State
    const [editingWorkflow, setEditingWorkflow] = useState<ServiceWorkflow | null>(null);
    const [formData, setFormData] = useState({
        status_code: '',
        status_label: '',
        step_order: 1,
        is_terminal: false,
        is_failure: false,
        is_active: true,
    });

    const fetchWorkflows = async () => {
        if (!serviceId) return;
        setLoading(true);
        try {
            const data = await getServiceWorkflows(serviceId);
            setWorkflows(data || []);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load workflows', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && serviceId) {
            fetchWorkflows();
            setView('list');
        }
    }, [isOpen, serviceId]);

    const handleAddNew = () => {
        setEditingWorkflow(null);
        // Default Order: next available integer
        const nextOrder = workflows.length > 0
            ? Math.max(...workflows.map(w => w.step_order)) + 1
            : 1;

        setFormData({
            status_code: '',
            status_label: '',
            step_order: nextOrder,
            is_terminal: false,
            is_failure: false,
            is_active: true,
        });
        setView('form');
    };

    const handleEdit = (workflow: ServiceWorkflow) => {
        setEditingWorkflow(workflow);
        setFormData({
            status_code: workflow.status_code,
            status_label: workflow.status_label,
            step_order: workflow.step_order,
            is_terminal: workflow.is_terminal,
            is_failure: workflow.is_failure,
            is_active: workflow.is_active,
        });
        setView('form');
    };

    const handleBackToList = () => {
        setView('list');
        setEditingWorkflow(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serviceId) return;

        setLoading(true);
        try {
            const payload = {
                service_id: serviceId,
                status_code: formData.status_code,
                status_label: formData.status_label,
                step_order: Number(formData.step_order),
                is_terminal: formData.is_terminal,
                is_failure: formData.is_failure,
                is_active: formData.is_active,
            };

            if (editingWorkflow) {
                await updateServiceWorkflow(editingWorkflow.id, payload);
                addToast('Workflow updated successfully', 'success');
            } else {
                await createServiceWorkflow(payload);
                addToast('Workflow created successfully', 'success');
            }

            fetchWorkflows();
            setView('list');
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to save workflow', 'error');
        } finally {
            setLoading(false);
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
                                {view === 'list' ? `Workflows: ${serviceName}` : (editingWorkflow ? 'Edit Step' : 'Add New Step')}
                            </h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                <span className="sr-only">Close</span>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {view === 'list' ? (
                            // LIST VIEW
                            <div>
                                <div className="flex justify-end mb-4">
                                    <button
                                        onClick={handleAddNew}
                                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                                    >
                                        Add Step
                                    </button>
                                </div>
                                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-300">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-6">Order</th>
                                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status Label</th>
                                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status Code</th>
                                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Flags</th>
                                                <th scope="col" className="relative py-3 pl-3 pr-4 sm:pr-6">
                                                    <span className="sr-only">Edit</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {loading ? (
                                                <tr><td colSpan={5} className="py-4 text-center text-sm text-gray-500">Loading...</td></tr>
                                            ) : workflows.length === 0 ? (
                                                <tr><td colSpan={5} className="py-4 text-center text-sm text-gray-500">No workflow steps defined.</td></tr>
                                            ) : (
                                                workflows.map((wf) => (
                                                    <tr key={wf.id}>
                                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{wf.step_order}</td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">{wf.status_label}</td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono text-xs">{wf.status_code}</td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            <div className="flex space-x-1">
                                                                {wf.is_terminal && <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">Terminal</span>}
                                                                {wf.is_failure && <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Failure</span>}
                                                                {!wf.is_active && <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Inactive</span>}
                                                            </div>
                                                        </td>
                                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                            <button
                                                                onClick={() => handleEdit(wf)}
                                                                className="text-indigo-600 hover:text-indigo-900"
                                                            >
                                                                Edit
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            // FORM VIEW
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="status_label" className="block text-sm font-medium text-gray-700">Status Label</label>
                                        <input
                                            type="text"
                                            id="status_label"
                                            required
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            value={formData.status_label}
                                            onChange={(e) => setFormData({ ...formData, status_label: e.target.value })}
                                            placeholder="e.g. Pending Verification"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="status_code" className="block text-sm font-medium text-gray-700">Status Code</label>
                                        <input
                                            type="text"
                                            id="status_code"
                                            required
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            value={formData.status_code}
                                            onChange={(e) => setFormData({ ...formData, status_code: e.target.value })}
                                            placeholder="e.g. pending_Verification"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Unique identifier for this step</p>
                                    </div>
                                    <div>
                                        <label htmlFor="step_order" className="block text-sm font-medium text-gray-700">Step Order</label>
                                        <input
                                            type="number"
                                            id="step_order"
                                            required
                                            min="0"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            value={formData.step_order}
                                            onChange={(e) => setFormData({ ...formData, step_order: parseInt(e.target.value) })}
                                        />
                                    </div>

                                    <div className="sm:col-span-2 space-y-2 pt-2">
                                        <div className="flex items-center">
                                            <input
                                                id="is_terminal"
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={formData.is_terminal}
                                                onChange={(e) => setFormData({ ...formData, is_terminal: e.target.checked })}
                                            />
                                            <label htmlFor="is_terminal" className="ml-2 block text-sm text-gray-900">
                                                Is Terminal Step (Completes the workflow)
                                            </label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                id="is_failure"
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={formData.is_failure}
                                                onChange={(e) => setFormData({ ...formData, is_failure: e.target.checked })}
                                            />
                                            <label htmlFor="is_failure" className="ml-2 block text-sm text-gray-900">
                                                Is Failure Step (Stops with error/rejection)
                                            </label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                id="is_active"
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={formData.is_active}
                                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            />
                                            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                                                Active
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:col-start-2 disabled:opacity-50"
                                    >
                                        {loading ? 'Saving...' : 'Save Step'}
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                                        onClick={handleBackToList}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceWorkflowsModal;
