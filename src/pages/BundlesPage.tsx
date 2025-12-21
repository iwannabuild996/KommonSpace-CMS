import { useEffect, useState } from 'react';
import { getBundles, deleteBundle } from '../services/api';
import type { Bundle } from '../services/api';
import BundleForm from '../components/BundleForm';
import { useToast } from '../hooks/useToast';

export default function BundlesPage() {
    const { addToast } = useToast();
    const [bundles, setBundles] = useState<Bundle[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [bundleToDelete, setBundleToDelete] = useState<Bundle | null>(null);

    const fetchBundles = async () => {
        setLoading(true);
        try {
            const data = await getBundles();
            setBundles(data || []);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load bundles', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBundles();
    }, []);

    const handleCreate = () => {
        setEditingBundle(null);
        setIsModalOpen(true);
    };

    const handleEdit = (bundle: Bundle) => {
        setEditingBundle(bundle);
        setIsModalOpen(true);
    };

    const confirmDelete = (bundle: Bundle) => {
        setBundleToDelete(bundle);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!bundleToDelete) return;

        try {
            await deleteBundle(bundleToDelete.id);
            addToast('Bundle deleted successfully', 'success');
            fetchBundles();
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to delete bundle', 'error');
        } finally {
            setIsDeleteModalOpen(false);
            setBundleToDelete(null);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-semibold text-gray-900">Bundles</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Manage package bundles and their included services.
                    </p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        Add Bundle
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
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Description</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-sm text-gray-500">Loading...</td>
                                        </tr>
                                    ) : bundles.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-sm text-gray-500">No bundles found.</td>
                                        </tr>
                                    ) : (
                                        bundles.map((bundle) => (
                                            <tr key={bundle.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{bundle.name}</td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">₹{bundle.price}</td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 truncate max-w-xs">{bundle.description}</td>
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    <button
                                                        onClick={() => handleEdit(bundle)}
                                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDelete(bundle)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        Delete
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

            <BundleForm
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchBundles}
                initialData={editingBundle}
            />

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsDeleteModalOpen(false)} />

                        <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
                            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                                        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                        </svg>
                                    </div>
                                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                                        <h3 className="text-base font-semibold leading-6 text-gray-900">Delete Bundle</h3>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-500">
                                                Are you sure you want to delete the bundle "{bundleToDelete?.name}"? This action cannot be undone.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                                <button
                                    type="button"
                                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                                    onClick={handleDelete}
                                >
                                    Delete
                                </button>
                                <button
                                    type="button"
                                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
