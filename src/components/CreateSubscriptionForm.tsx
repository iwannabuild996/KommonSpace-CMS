import { useState, useEffect } from 'react';
import { getUsers, getPlans, getBundles, getBundleItems, createSubscription, createPayment } from '../services/api';
import type { User, Plan, Bundle } from '../services/api';
import { useToast } from '../hooks/useToast';
import CreateUserModal from './CreateUserModal'; // Reusing this

const steps = ['Plan & User', 'Dates & Amounts', 'Signatory & Company', 'Review'];

interface CreateSubscriptionFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}



export default function CreateSubscriptionForm({ onSuccess, onCancel }: CreateSubscriptionFormProps) {
    const { addToast } = useToast();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);

    // Data Sources
    const [users, setUsers] = useState<User[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [bundles, setBundles] = useState<Bundle[]>([]); // New

    // UI State
    const [selectionType, setSelectionType] = useState<'plan' | 'bundle'>('plan');

    // Search State
    const [userSearch, setUserSearch] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        // Step 1
        user_id: '',
        plan_id: '',
        bundle_id: '', // New
        suite_number: '',

        // Step 2
        purchased_date: new Date().toISOString().split('T')[0],
        start_date: '',
        expiry_date: '',
        purchase_amount: '',   // string for input
        renewal_amount: '',    // string for input - New field
        initial_payment: '',   // string for input - renamed from received_amount
        payment_type: 'Bank Transfer' as 'Bank Transfer' | 'Cash',

        // Step 3
        signatory_type: 'individual' as 'company' | 'individual',
        signatory_designation: '',
        company_name: '',
        signatory_name: '',
        signatory_aadhaar: '',
        signatory_address: '',
        company_address: '',
        rubber_stamp: 'Not Available' as 'Not Available' | 'Available' | 'With Client',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [fetchedUsers, fetchedPlans, fetchedBundles] = await Promise.all([getUsers(), getPlans(), getBundles()]);
            setUsers(fetchedUsers || []);
            setPlans(fetchedPlans || []);
            setBundles(fetchedBundles || []);
        } catch (e) {
            addToast('Failed to load users or plans', 'error');
        }
    };

    const validateStep = (step: number) => {
        switch (step) {
            case 0:
                if (!formData.user_id) return 'Please select a user';
                if (selectionType === 'plan' && !formData.plan_id) return 'Please select a plan';
                if (selectionType === 'bundle' && !formData.bundle_id) return 'Please select a bundle';
                if (!formData.suite_number) return 'Please enter a suite number';
                return null;
            case 1:
                if (!formData.purchased_date) return 'Purchase date is required';
                if (!formData.purchase_amount || isNaN(Number(formData.purchase_amount))) return 'Valid purchase amount is required';
                // renewal_amount is optional, but if present must be number
                if (formData.renewal_amount && isNaN(Number(formData.renewal_amount))) return 'Valid renewal amount is required';
                return null;
            case 2:
                // All fields in Signatory & Company are optional
                return null;
            default:
                return null;
        }
    };

    const handleNext = () => {
        const error = validateStep(activeStep);
        if (error) {
            addToast(error, 'error');
            return;
        }
        setActiveStep((prev) => prev + 1);
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // 1. Prepare data
            let finalPlanId = formData.plan_id;

            // If Bundle selected, fetch its items to find the Plan
            if (formData.bundle_id && !finalPlanId) {
                const bundleItems = await getBundleItems(formData.bundle_id);
                const planItem = bundleItems?.find(item => item.item_type === 'plan' || item.plans);
                if (planItem && (planItem.item_id || planItem.plans?.id)) {
                    finalPlanId = planItem.item_id || planItem.plans?.id || '';
                }

                if (!finalPlanId) {
                    // Fallback or error if strictly required. 
                    // User said "always need to fill", but if bundle has no plan, we might just proceed with empty?
                    // For now, let's warn but proceed, or throw error? 
                    // Given constraints, better to throw if really required, but let's try to proceed.
                    // Actually, if user insists "always need to fill", we should probably error if missing.
                    throw new Error("Selected bundle does not contain a valid Plan.");
                }
            }

            // 1. Create Subscription
            const newSub = await createSubscription({
                ...formData,
                plan_id: finalPlanId,
                bundle_id: formData.bundle_id || undefined, // Set to undefined if empty string to avoid invalid input syntax for type uuid
                start_date: formData.start_date || undefined,
                expiry_date: formData.expiry_date || undefined,
                purchase_amount: Number(formData.purchase_amount),
                renewal_amount: formData.renewal_amount ? Number(formData.renewal_amount) : undefined, // Add to payload
                received_amount: 0, // Always 0 initially, updated via trigger on payment creation
                status: 'Advance Received', // Default initial status
            });

            // 2. If Initial Payment is entered, create a Payment Record
            if (formData.initial_payment && Number(formData.initial_payment) > 0) {
                await createPayment({
                    subscription_id: newSub.id,
                    user_id: formData.user_id, // Ensure this maps correctly if needed
                    amount: Number(formData.initial_payment),
                    payment_date: formData.purchased_date, // Use purchased date as payment date
                    payment_type: formData.payment_type,
                });
            }

            addToast('Subscription created successfully!', 'success');
            onSuccess();
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to create subscription', 'error');
        } finally {
            setLoading(false);
        }
    };

    const selectedUser = users.find(u => u.id === formData.user_id);
    const selectedPlan = plans.find(p => p.id === formData.plan_id);
    const selectedBundle = bundles.find(b => b.id === formData.bundle_id);

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (user.phone || '').toLowerCase().includes(userSearch.toLowerCase())
    );

    return (
        <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">

                {/* Stepper Header */}
                <div className="mb-8">
                    <h2 className="sr-only">Steps</h2>
                    <div className="relative after:absolute after:inset-x-0 after:top-1/2 after:block after:h-0.5 after:-translate-y-1/2 after:rounded-lg after:bg-gray-200">
                        <ol className="relative z-10 flex justify-between text-sm font-medium text-gray-500">
                            {steps.map((step, index) => (
                                <li key={step} className="flex items-center gap-2 bg-white p-2">
                                    <span className={`h-6 w-6 rounded-full text-center text-[10px]/6 font-bold ${index <= activeStep ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>
                                        {index + 1}
                                    </span>
                                    <span className={`hidden sm:block ${index <= activeStep ? 'text-indigo-600' : ''}`}> {step} </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>

                {/* Form Content */}
                <div className="mt-4 min-h-[300px]">
                    {activeStep === 0 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">User</label>
                                    <div className="mt-1 flex gap-2">
                                        <div className="relative flex-grow">
                                            <input
                                                type="text"
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                placeholder="Search user..."
                                                value={userSearch}
                                                onChange={(e) => {
                                                    setUserSearch(e.target.value);
                                                    if (formData.user_id) setFormData({ ...formData, user_id: '' });
                                                }}
                                            />
                                            {userSearch && !formData.user_id && (
                                                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                                    {filteredUsers.length === 0 ? (
                                                        <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                                                            No users found.
                                                        </div>
                                                    ) : (
                                                        filteredUsers.map((user) => (
                                                            <div
                                                                key={user.id}
                                                                className="relative cursor-default select-none py-2 pl-3 pr-9 hover:bg-indigo-600 hover:text-white group"
                                                                onClick={() => {
                                                                    setFormData({ ...formData, user_id: user.id });
                                                                    setUserSearch(user.name);
                                                                }}
                                                            >
                                                                <span className="block truncate font-medium text-gray-900 group-hover:text-white">
                                                                    {user.name}
                                                                </span>
                                                                <span className="block truncate text-xs text-gray-500 group-hover:text-indigo-200">
                                                                    {user.email && user.phone
                                                                        ? `${user.email} • ${user.phone}`
                                                                        : (user.email || user.phone || 'No contact info')}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsUserModalOpen(true)}
                                            className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 h-[38px]"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Type</label>
                                    <div className="flex rounded-md shadow-sm mb-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectionType('plan');
                                                setFormData({ ...formData, bundle_id: '', purchase_amount: '' });
                                            }}
                                            className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 focus:z-10 ${selectionType === 'plan' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 hover:bg-gray-50'}`}
                                        >
                                            Plan
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectionType('bundle');
                                                setFormData({ ...formData, plan_id: '', purchase_amount: '' });
                                            }}
                                            className={`relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 focus:z-10 ${selectionType === 'bundle' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 hover:bg-gray-50'}`}
                                        >
                                            Bundle
                                        </button>
                                    </div>

                                    {selectionType === 'plan' ? (
                                        <>
                                            <label className="block text-sm font-medium text-gray-700">Select Plan</label>
                                            <select
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                value={formData.plan_id}
                                                onChange={(e) => {
                                                    const plan = plans.find(p => p.id === e.target.value);
                                                    setFormData({
                                                        ...formData,
                                                        plan_id: e.target.value,
                                                        bundle_id: '',
                                                        purchase_amount: plan?.price ? plan.price.toString() : formData.purchase_amount
                                                    })
                                                }}
                                            >
                                                <option value="">Choose a Plan...</option>
                                                {plans.map(p => <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>)}
                                            </select>
                                        </>
                                    ) : (
                                        <>
                                            <label className="block text-sm font-medium text-gray-700">Select Bundle</label>
                                            <select
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                value={formData.bundle_id}
                                                onChange={(e) => {
                                                    const bundle = bundles.find(b => b.id === e.target.value);
                                                    setFormData({
                                                        ...formData,
                                                        bundle_id: e.target.value,
                                                        plan_id: '',
                                                        purchase_amount: bundle?.price ? bundle.price.toString() : formData.purchase_amount
                                                    })
                                                }}
                                            >
                                                <option value="">Choose a Bundle...</option>
                                                {bundles.map(b => <option key={b.id} value={b.id}>{b.name} - ₹{b.price}</option>)}
                                            </select>
                                        </>
                                    )}
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Suite Number</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.suite_number}
                                        onChange={(e) => setFormData({ ...formData, suite_number: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeStep === 1 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Purchased Date</label>
                                    <input type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.purchased_date} onChange={(e) => setFormData({ ...formData, purchased_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Start Date (Optional)</label>
                                    <input type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Expiry Date (Optional)</label>
                                    <input type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Purchase Amount (₹)</label>
                                    <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.purchase_amount} onChange={(e) => setFormData({ ...formData, purchase_amount: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Renewal Amount (₹)</label>
                                    <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.renewal_amount} onChange={(e) => setFormData({ ...formData, renewal_amount: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Initial Payment (₹)</label>
                                    <div className="flex gap-2">
                                        <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            value={formData.initial_payment} onChange={(e) => setFormData({ ...formData, initial_payment: e.target.value })} />
                                        <select
                                            className="mt-1 block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            value={formData.payment_type}
                                            onChange={(e) => setFormData({ ...formData, payment_type: e.target.value as 'Bank Transfer' | 'Cash' })}
                                        >
                                            <option value="Bank Transfer">Bank</option>
                                            <option value="Cash">Cash</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}



                    {activeStep === 2 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Signatory Type</label>
                                <div className="mt-2 flex gap-4">
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio text-indigo-600"
                                            name="signatoryType"
                                            value="individual"
                                            checked={formData.signatory_type === 'individual'}
                                            onChange={() => setFormData({ ...formData, signatory_type: 'individual' })}
                                        />
                                        <span className="ml-2">Individual</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio text-indigo-600"
                                            name="signatoryType"
                                            value="company"
                                            checked={formData.signatory_type === 'company'}
                                            onChange={() => setFormData({ ...formData, signatory_type: 'company' })}
                                        />
                                        <span className="ml-2">Company</span>
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Company Name</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.company_name}
                                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Company Address</label>
                                    <textarea
                                        rows={2}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.company_address}
                                        onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Signatory Name</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.signatory_name}
                                        onChange={(e) => setFormData({ ...formData, signatory_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Designation</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.signatory_designation}
                                        onChange={(e) => setFormData({ ...formData, signatory_designation: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Signatory Aadhaar (Optional)</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.signatory_aadhaar}
                                        onChange={(e) => setFormData({ ...formData, signatory_aadhaar: e.target.value })}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Signatory Address</label>
                                    <textarea
                                        rows={2}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        value={formData.signatory_address}
                                        onChange={(e) => setFormData({ ...formData, signatory_address: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeStep === 3 && (
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                            <h3 className="text-sm font-medium text-gray-900 mb-4">Review Subscription Details</h3>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">User</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{selectedUser?.name}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">
                                        {formData.plan_id ? 'Plan' : 'Bundle'}
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900">
                                        {formData.plan_id ? selectedPlan?.name : selectedBundle?.name}
                                    </dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{formData.start_date || '-'}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Amount</dt>
                                    <dd className="mt-1 text-sm text-gray-900">₹{formData.purchase_amount}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Renewal Amount</dt>
                                    <dd className="mt-1 text-sm text-gray-900">₹{formData.renewal_amount || '-'}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Signatory Type</dt>
                                    <dd className="mt-1 text-sm text-gray-900 capitalize">{formData.signatory_type}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Company</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{formData.company_name || '-'}</dd>
                                </div>
                                <div className="sm:col-span-1">
                                    <dt className="text-sm font-medium text-gray-500">Signatory Name</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{formData.signatory_name || '-'}</dd>
                                </div>
                            </dl>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="mt-8 flex justify-between pt-5 border-t border-gray-200">
                    {activeStep > 0 ? (
                        <button
                            type="button"
                            onClick={handleBack}
                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                            Back
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                    )}

                    {activeStep < steps.length - 1 ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            className="ml-auto rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="ml-auto rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50"
                        >
                            {loading ? 'Submitting...' : 'Confirm Subscription'}
                        </button>
                    )}
                </div>
            </div>

            <CreateUserModal
                isOpen={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                onSuccess={() => {
                    loadData();
                }}
            />
        </div>
    );
}
