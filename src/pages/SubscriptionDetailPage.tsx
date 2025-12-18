import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubscription, updateSubscription, getSubscriptionLogs, uploadSubscriptionFile, getSubscriptionFiles, extractSubscriptionData, updateSubscriptionFile, updateSubscriptionSignatory, updateSubscriptionCompany } from '../services/api';
import type { SubscriptionStatus, RubberStampStatus, SubscriptionFile, SubscriptionFileLabel } from '../services/api';
import { useToast } from '../hooks/useToast';
import { supabase } from '../services/supabase';

interface Log {
    id: string;
    created_at: string;
    new_status: string;
    old_status: string | null;
}

export default function SubscriptionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [subscription, setSubscription] = useState<any>(null);
    const [logs, setLogs] = useState<Log[]>([]);
    const [files, setFiles] = useState<SubscriptionFile[]>([]);

    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [extracting, setExtracting] = useState<string | null>(null); // file id being extracted
    const [viewingData, setViewingData] = useState<SubscriptionFile | null>(null); // file being viewed
    const [editedData, setEditedData] = useState<any>(null); // buffer for editing extracted data

    // Signatory Edit State
    const [isEditingSignatory, setIsEditingSignatory] = useState(false);
    const [signatoryEditData, setSignatoryEditData] = useState<any>({});
    const [companyEditData, setCompanyEditData] = useState<any>({});
    const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
    const [coiFile, setCoiFile] = useState<File | null>(null);

    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [extractedDataPreview, setExtractedDataPreview] = useState<any>(null);

    // Edit State
    const [status, setStatus] = useState<SubscriptionStatus>('Advance Received');
    const [rubberStamp, setRubberStamp] = useState<RubberStampStatus>('Not Available');

    // File Upload State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileLabel, setFileLabel] = useState<SubscriptionFileLabel>('Others');

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [subData, logsData, filesData] = await Promise.all([
                getSubscription(id),
                getSubscriptionLogs(id),
                getSubscriptionFiles(id)
            ]);
            setSubscription(subData);
            setLogs(logsData as any[]);
            setFiles(filesData);

            // Initialize edit state
            if (subData) {
                setStatus(subData.status);
                setRubberStamp(subData.rubber_stamp || 'Not Available');
            }
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load subscription details', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    useEffect(() => {
        if (viewingData?.extracted_data) {
            setEditedData(viewingData.extracted_data);
        } else {
            setEditedData(null);
        }
    }, [viewingData]);

    const handleSave = async () => {
        if (!id) return;
        setUpdating(true);
        try {
            await updateSubscription(id, {
                status: status,
                rubber_stamp: rubberStamp
            });
            addToast('Subscription updated successfully', 'success');
            fetchData(); // Refresh data to get new log and updated state
        } catch (err: any) {
            console.error(err);
            addToast('Failed to update subscription', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleExtractData = async (file: SubscriptionFile) => {
        setExtracting(file.id);
        try {
            const functionName = file.label === 'Certificate of Incorporation' ? 'extract-coi' : 'extract-aadhaar';
            const extracted = await extractSubscriptionData(file.file_path, file.mime_type, functionName);

            if (extracted) {
                // 1. Save extracted data to file record
                await updateSubscriptionFile(file.id, { extracted_data: extracted });

                // 2. Update Signatory or Company table
                if (file.label === 'Certificate of Incorporation') {
                    // Update company data
                    const companyUpdates: any = {};
                    if (extracted.company_name) companyUpdates.name = extracted.company_name;
                    if (extracted.address) companyUpdates.address = extracted.address;
                    if (extracted.cin) companyUpdates.cin = extracted.cin;
                    if (extracted.pan) companyUpdates.pan = extracted.pan;
                    if (extracted.tan) companyUpdates.tan = extracted.tan;

                    if (Object.keys(companyUpdates).length > 0) {
                        await updateSubscriptionCompany(id!, companyUpdates);
                        addToast('Company details extracted and saved successfully', 'success');
                        fetchData();
                    } else {
                        addToast('Data extracted but no fields matched for update', 'info');
                    }
                } else {
                    // Update signatory data (Aadhaar)
                    const signatoryUpdates: any = {};
                    if (extracted.name) signatoryUpdates.name = extracted.name;
                    if (extracted.address) signatoryUpdates.address = extracted.address;
                    if (extracted.aadhaar_number) signatoryUpdates.aadhaar_number = extracted.aadhaar_number;

                    if (Object.keys(signatoryUpdates).length > 0) {
                        await updateSubscriptionSignatory(id!, signatoryUpdates);
                        addToast('Signatory details extracted and saved successfully', 'success');
                        fetchData();
                    } else {
                        addToast('Data extracted but no fields matched for update', 'info');
                    }
                }
            }
        } catch (err: any) {
            console.error(err);
            addToast('Failed to extract data: ' + err.message, 'error');
        } finally {
            setExtracting(null);
        }
    };

    const handleUpdateExtractedData = async () => {
        if (!viewingData || !id || !editedData) return;
        setExtracting(viewingData.id); // Re-use extracting state for loading spinner
        try {
            // 1. Update File Record
            await updateSubscriptionFile(viewingData.id, { extracted_data: editedData });

            // 2. Update Signatory or Company table based on file type
            if (viewingData.label === 'Certificate of Incorporation') {
                // Update company data
                const companyUpdates: any = {};
                if (editedData.company_name) companyUpdates.name = editedData.company_name;
                if (editedData.address) companyUpdates.address = editedData.address;
                if (editedData.cin) companyUpdates.cin = editedData.cin;
                if (editedData.pan) companyUpdates.pan = editedData.pan;
                if (editedData.tan) companyUpdates.tan = editedData.tan;

                if (Object.keys(companyUpdates).length > 0) {
                    await updateSubscriptionCompany(id, companyUpdates);
                    addToast('Company data updated and saved successfully', 'success');
                    fetchData();
                    setViewingData(null);
                } else {
                    addToast('No valid fields to update', 'info');
                }
            } else {
                // Update signatory data (Aadhaar)
                const signatoryUpdates: any = {};
                if (editedData.name) signatoryUpdates.name = editedData.name;
                if (editedData.address) signatoryUpdates.address = editedData.address;
                if (editedData.aadhaar_number) signatoryUpdates.aadhaar_number = editedData.aadhaar_number;

                if (Object.keys(signatoryUpdates).length > 0) {
                    await updateSubscriptionSignatory(id, signatoryUpdates);
                    addToast('Signatory data updated and saved successfully', 'success');
                    fetchData();
                    setViewingData(null);
                } else {
                    addToast('No valid fields to update', 'info');
                }
            }

        } catch (err: any) {
            console.error(err);
            addToast('Failed to save changes: ' + err.message, 'error');
        } finally {
            setExtracting(null);
        }
    };

    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !selectedFile) return;

        setUploading(true);
        try {
            await uploadSubscriptionFile(id, selectedFile, fileLabel);
            addToast('File uploaded successfully', 'success');
            setSelectedFile(null);
            // Refresh files list
            const filesData = await getSubscriptionFiles(id);
            setFiles(filesData);
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to upload file', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleSaveSignatory = async () => {
        if (!id) return;
        setUpdating(true);
        try {
            // Prepare signatory updates
            const signatoryUpdates: any = { ...signatoryEditData };
            const companyUpdates: any = { ...companyEditData };

            // 1. Upload Aadhaar file if provided and update signatory data with file info
            if (aadhaarFile) {
                const uploadedFile = await uploadSubscriptionFile(id, aadhaarFile, 'Signatory Aadhaar');
                signatoryUpdates.aadhaar_file_path = uploadedFile.file_path;
                signatoryUpdates.aadhaar_file_name = uploadedFile.file_name;
            }

            // 2. Upload COI file if provided and update company data with file info
            if (coiFile && subscription.signatory_type === 'company') {
                const uploadedFile = await uploadSubscriptionFile(id, coiFile, 'Certificate of Incorporation');
                companyUpdates.coi_file_path = uploadedFile.file_path;
                companyUpdates.coi_file_name = uploadedFile.file_name;
            }

            // 3. Update Signatory Data
            await updateSubscriptionSignatory(id, signatoryUpdates);

            // 4. Update Company Data if company type
            if (subscription.signatory_type === 'company') {
                await updateSubscriptionCompany(id, companyUpdates);
            }

            addToast('Signatory details updated successfully', 'success');
            setIsEditingSignatory(false);
            setAadhaarFile(null);
            setCoiFile(null);
            fetchData(); // Refresh data
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to update signatory details', 'error');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading subscription details...</div>;

    if (!subscription) return <div className="p-8 text-center text-gray-500">Subscription not found</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="md:flex md:items-center md:justify-between mb-8">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Subscription Details
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">#{subscription.id}</p>
                </div>
                <div className="mt-4 flex md:ml-4 md:mt-0">
                    <button
                        type="button"
                        onClick={() => navigate('/subscriptions')}
                        className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                        Back to List
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left Column: Details & Status Control */}
                <div className="space-y-6">

                    {/* Status Control Card */}
                    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 bg-indigo-50 border-b border-indigo-100">
                            <h3 className="text-base font-semibold leading-6 text-indigo-900">Update Status</h3>
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                                <div className="sm:col-span-3">
                                    <label htmlFor="status" className="block text-sm font-medium leading-6 text-gray-900">Subscription Status</label>
                                    <div className="mt-2">
                                        <select
                                            id="status"
                                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                                        >
                                            <option value="Advance Received">Advance Received</option>
                                            <option value="Paper Collected">Paper Collected</option>
                                            <option value="Documents Ready">Documents Ready</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="sm:col-span-3">
                                    <label htmlFor="rubber_stamp" className="block text-sm font-medium leading-6 text-gray-900">Rubber Stamp</label>
                                    <div className="mt-2">
                                        <select
                                            id="rubber_stamp"
                                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                            value={rubberStamp}
                                            onChange={(e) => setRubberStamp(e.target.value as RubberStampStatus)}
                                        >
                                            <option value="Not Available">Not Available</option>
                                            <option value="Available">Available</option>
                                            <option value="With Client">With Client</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center justify-end gap-x-6">
                                <button
                                    type="submit"
                                    disabled={updating}
                                    onClick={handleSave}
                                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                                >
                                    {updating ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Details Card */}
                    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6">
                            <h3 className="text-base font-semibold leading-6 text-gray-900">Information</h3>
                            <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about the subscription and signatory.</p>
                        </div>
                        <div className="border-t border-gray-100">
                            <dl className="divide-y divide-gray-100">
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">User</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.users?.name}</dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Plan</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.plans?.name}</dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Suite Number</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.suite_number || '-'}</dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Dates</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                        <p>Purchased: {subscription.purchased_date}</p>
                                        <p>Start: {subscription.start_date}</p>
                                        <p>Expiry: {subscription.expiry_date}</p>
                                    </dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Financials</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                        <p>Amount: ₹{subscription.purchase_amount}</p>
                                        <p>Received: ₹{subscription.received_amount}</p>
                                    </dd>
                                </div>
                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-900">Signatory Type</dt>
                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${subscription.signatory_type === 'company' ? 'bg-blue-50 text-blue-700 ring-blue-700/10' : 'bg-green-50 text-green-700 ring-green-700/10'}`}>
                                            {subscription.signatory_type === 'company' ? 'Company' : 'Individual'}
                                        </span>
                                    </dd>
                                </div>

                            </dl>
                        </div>
                    </div>

                    {/* Signatory Details Card */}
                    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-semibold leading-6 text-gray-900">Signatory Details</h3>
                                <p className="mt-1 max-w-2xl text-sm text-gray-500">Information about the signatory.</p>
                            </div>
                            {!isEditingSignatory && (
                                <button
                                    onClick={() => {
                                        setIsEditingSignatory(true);
                                        setSignatoryEditData({
                                            name: subscription.subscription_signatories?.name || '',
                                            designation: subscription.subscription_signatories?.designation || '',
                                            aadhaar_number: subscription.subscription_signatories?.aadhaar_number || '',
                                            address: subscription.subscription_signatories?.address || '',
                                        });
                                        setCompanyEditData({
                                            name: subscription.subscription_companies?.name || '',
                                            address: subscription.subscription_companies?.address || '',
                                            cin: subscription.subscription_companies?.cin || '',
                                            pan: subscription.subscription_companies?.pan || '',
                                            tan: subscription.subscription_companies?.tan || '',
                                        });
                                    }}
                                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="border-t border-gray-100">
                            {!isEditingSignatory ? (
                                <dl className="divide-y divide-gray-100">
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">Name</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                            <p className="font-semibold">{subscription.subscription_signatories?.name || '-'}</p>
                                            {subscription.subscription_signatories?.designation && (
                                                <p className="text-gray-500 text-xs mt-1">Designation: {subscription.subscription_signatories.designation}</p>
                                            )}
                                        </dd>
                                    </div>
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">Aadhaar Number</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.subscription_signatories?.aadhaar_number || '-'}</dd>
                                    </div>
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">Address</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.subscription_signatories?.address || '-'}</dd>
                                    </div>
                                    {subscription.subscription_signatories?.aadhaar_file_name && (
                                        <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                            <dt className="text-sm font-medium text-gray-900">Aadhaar File</dt>
                                            <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                                <div className="flex items-center gap-3">
                                                    <a
                                                        href="#"
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            const { data } = await supabase.storage
                                                                .from('kommonspace')
                                                                .createSignedUrl(subscription.subscription_signatories!.aadhaar_file_path!, 3600);
                                                            if (data?.signedUrl) {
                                                                window.open(data.signedUrl, '_blank');
                                                            }
                                                        }}
                                                        className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        {subscription.subscription_signatories.aadhaar_file_name}
                                                    </a>
                                                    <button
                                                        onClick={async () => {
                                                            setUpdating(true);
                                                            try {
                                                                // Extract data first
                                                                const extracted = await extractSubscriptionData(
                                                                    subscription.subscription_signatories!.aadhaar_file_path!,
                                                                    'application/pdf',
                                                                    'extract-aadhaar'
                                                                );

                                                                if (extracted) {
                                                                    const updates: any = {};
                                                                    if (extracted.name) updates.name = extracted.name;
                                                                    if (extracted.address) updates.address = extracted.address;
                                                                    if (extracted.aadhaar_number) updates.aadhaar_number = extracted.aadhaar_number;

                                                                    if (Object.keys(updates).length > 0) {
                                                                        // Show extracted data for confirmation
                                                                        setExtractedDataPreview(updates);
                                                                        setConfirmMessage('Review the extracted data and confirm to update:');
                                                                        setConfirmAction(() => async () => {
                                                                            try {
                                                                                await updateSubscriptionSignatory(id!, updates);
                                                                                addToast('Data extracted and saved successfully', 'success');
                                                                                fetchData();
                                                                                setExtractedDataPreview(null);
                                                                            } catch (err: any) {
                                                                                alert('Error saving data: ' + (err.message || 'Unknown error'));
                                                                            }
                                                                        });
                                                                        setShowConfirmModal(true);
                                                                    } else {
                                                                        addToast('No data could be extracted from the file', 'info');
                                                                    }
                                                                }
                                                            } catch (err: any) {
                                                                console.error(err);
                                                                alert('Error extracting data: ' + (err.message || 'Unknown error'));
                                                            } finally {
                                                                setUpdating(false);
                                                            }
                                                        }}
                                                        disabled={updating}
                                                        className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
                                                    >
                                                        Extract Data
                                                    </button>
                                                </div>
                                            </dd>
                                        </div>
                                    )}
                                    {subscription.signatory_type === 'company' && (
                                        <>
                                            <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50">
                                                <dt className="text-sm font-medium text-gray-900">Company Name</dt>
                                                <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0 font-semibold">{subscription.subscription_companies?.name || '-'}</dd>
                                            </div>
                                            <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50">
                                                <dt className="text-sm font-medium text-gray-900">Company Address</dt>
                                                <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.subscription_companies?.address || '-'}</dd>
                                            </div>
                                            {subscription.subscription_companies?.coi_file_name && (
                                                <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50">
                                                    <dt className="text-sm font-medium text-gray-900">COI File</dt>
                                                    <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                                        <div className="flex items-center gap-3">
                                                            <a
                                                                href="#"
                                                                onClick={async (e) => {
                                                                    e.preventDefault();
                                                                    const { data } = await supabase.storage
                                                                        .from('kommonspace')
                                                                        .createSignedUrl(subscription.subscription_companies!.coi_file_path!, 3600);
                                                                    if (data?.signedUrl) {
                                                                        window.open(data.signedUrl, '_blank');
                                                                    }
                                                                }}
                                                                className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                {subscription.subscription_companies.coi_file_name}
                                                            </a>
                                                            <button
                                                                onClick={async () => {
                                                                    setUpdating(true);
                                                                    try {
                                                                        // Extract data first
                                                                        const extracted = await extractSubscriptionData(
                                                                            subscription.subscription_companies!.coi_file_path!,
                                                                            'application/pdf',
                                                                            'extract-coi'
                                                                        );

                                                                        if (extracted) {
                                                                            const updates: any = {};
                                                                            if (extracted.company_name) updates.name = extracted.company_name;
                                                                            if (extracted.address) updates.address = extracted.address;
                                                                            if (extracted.cin) updates.cin = extracted.cin;
                                                                            if (extracted.pan) updates.pan = extracted.pan;
                                                                            if (extracted.tan) updates.tan = extracted.tan;

                                                                            if (Object.keys(updates).length > 0) {
                                                                                // Show extracted data for confirmation
                                                                                setExtractedDataPreview(updates);
                                                                                setConfirmMessage('Review the extracted data and confirm to update:');
                                                                                setConfirmAction(() => async () => {
                                                                                    try {
                                                                                        await updateSubscriptionCompany(id!, updates);
                                                                                        addToast('Data extracted and saved successfully', 'success');
                                                                                        fetchData();
                                                                                        setExtractedDataPreview(null);
                                                                                    } catch (err: any) {
                                                                                        alert('Error saving data: ' + (err.message || 'Unknown error'));
                                                                                    }
                                                                                });
                                                                                setShowConfirmModal(true);
                                                                            } else {
                                                                                addToast('No data could be extracted from the file', 'info');
                                                                            }
                                                                        }
                                                                    } catch (err: any) {
                                                                        console.error(err);
                                                                        alert('Error extracting data: ' + (err.message || 'Unknown error'));
                                                                    } finally {
                                                                        setUpdating(false);
                                                                    }
                                                                }}
                                                                disabled={updating}
                                                                className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
                                                            >
                                                                Extract Data
                                                            </button>
                                                        </div>
                                                    </dd>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </dl>
                            ) : (
                                <div className="p-6 space-y-6">
                                    {/* Signatory Fields */}
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Name</label>
                                            <input
                                                type="text"
                                                value={signatoryEditData.name || ''}
                                                onChange={(e) => setSignatoryEditData({ ...signatoryEditData, name: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Designation</label>
                                            <input
                                                type="text"
                                                value={signatoryEditData.designation || ''}
                                                onChange={(e) => setSignatoryEditData({ ...signatoryEditData, designation: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Aadhaar Number</label>
                                            <input
                                                type="text"
                                                value={signatoryEditData.aadhaar_number || ''}
                                                onChange={(e) => setSignatoryEditData({ ...signatoryEditData, aadhaar_number: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Aadhaar File</label>
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={(e) => setAadhaarFile(e.target.files?.[0] || null)}
                                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                            />
                                            {aadhaarFile && <p className="mt-1 text-xs text-gray-500">{aadhaarFile.name}</p>}
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Address</label>
                                            <textarea
                                                rows={3}
                                                value={signatoryEditData.address || ''}
                                                onChange={(e) => setSignatoryEditData({ ...signatoryEditData, address: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                    </div>

                                    {/* Company Fields (if company type) */}
                                    {subscription.signatory_type === 'company' && (
                                        <div className="border-t border-gray-200 pt-6">
                                            <h4 className="text-sm font-medium text-gray-900 mb-4">Company Details</h4>
                                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Company Name</label>
                                                    <input
                                                        type="text"
                                                        value={companyEditData.name || ''}
                                                        onChange={(e) => setCompanyEditData({ ...companyEditData, name: e.target.value })}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">CIN</label>
                                                    <input
                                                        type="text"
                                                        value={companyEditData.cin || ''}
                                                        onChange={(e) => setCompanyEditData({ ...companyEditData, cin: e.target.value })}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">PAN</label>
                                                    <input
                                                        type="text"
                                                        value={companyEditData.pan || ''}
                                                        onChange={(e) => setCompanyEditData({ ...companyEditData, pan: e.target.value })}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">TAN</label>
                                                    <input
                                                        type="text"
                                                        value={companyEditData.tan || ''}
                                                        onChange={(e) => setCompanyEditData({ ...companyEditData, tan: e.target.value })}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">COI File</label>
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        onChange={(e) => setCoiFile(e.target.files?.[0] || null)}
                                                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                                    />
                                                    {coiFile && <p className="mt-1 text-xs text-gray-500">{coiFile.name}</p>}
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <label className="block text-sm font-medium text-gray-700">Company Address</label>
                                                    <textarea
                                                        rows={3}
                                                        value={companyEditData.address || ''}
                                                        onChange={(e) => setCompanyEditData({ ...companyEditData, address: e.target.value })}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => {
                                                setIsEditingSignatory(false);
                                                setAadhaarFile(null);
                                                setCoiFile(null);
                                            }}
                                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveSignatory}
                                            disabled={updating}
                                            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                                        >
                                            {updating ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Files & Timeline */}
                <div className="space-y-6">

                    {/* Files Section */}
                    <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                            <h3 className="text-base font-semibold leading-6 text-gray-900">Files</h3>
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            {/* File List */}
                            <ul role="list" className="divide-y divide-gray-100 rounded-md border border-gray-200 mb-6">
                                {files.length === 0 && (
                                    <li className="flex items-center justify-center py-4 text-sm text-gray-500">No files uploaded yet.</li>
                                )}
                                {files.map((file) => (
                                    <li key={file.id} className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                                        <div className="flex w-0 flex-1 items-center">
                                            <svg className="h-5 w-5 flex-shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                                            </svg>
                                            <div className="ml-4 flex min-w-0 flex-1 gap-2 flex-col items-start">
                                                <div className="flex gap-2">
                                                    <span className="truncate font-medium">{file.file_name}</span>
                                                    <span className="flex-shrink-0 text-gray-400">({file.label})</span>
                                                </div>
                                                {(file.label === 'Signatory Aadhaar' || file.label === 'Certificate of Incorporation') && (
                                                    file.extracted_data ? (
                                                        <button
                                                            onClick={() => setViewingData(file)}
                                                            className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100"
                                                        >
                                                            View Data
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleExtractData(file)}
                                                            disabled={extracting === file.id}
                                                            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 disabled:opacity-50"
                                                        >
                                                            {extracting === file.id ? 'Extracting...' : 'Extract Data'}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                        <div className="ml-4 flex-shrink-0">
                                            {file.signedUrl ? (
                                                <a href={file.signedUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-500">
                                                    Download
                                                </a>
                                            ) : (
                                                <span className="text-gray-400">Expired</span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            {/* Upload Form */}
                            <form onSubmit={handleFileUpload} className="space-y-3 p-4 bg-gray-50 rounded-md">
                                <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">Upload Document</label>
                                    <div className="mt-2 flex gap-2">
                                        <select
                                            className="block w-1/3 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                            value={fileLabel}
                                            onChange={(e) => setFileLabel(e.target.value as SubscriptionFileLabel)}
                                        >
                                            <option value="Signatory Aadhaar">Signatory Aadhaar</option>
                                            <option value="Certificate of Incorporation">Incorporation Cert</option>
                                            <option value="Others">Others</option>
                                        </select>
                                        <input
                                            type="file"
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <button
                                        type="submit"
                                        disabled={!selectedFile || uploading}
                                        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {uploading ? 'Uploading...' : 'Upload'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                            <h3 className="text-base font-semibold leading-6 text-gray-900">Activity Timeline</h3>
                        </div>
                        <div className="p-6">
                            <div className="flow-root">
                                <ul role="list" className="-mb-8">
                                    {logs.length === 0 && <p className="text-sm text-gray-500">No logs found.</p>}
                                    {logs.map((log, logIdx) => (
                                        <li key={log.id}>
                                            <div className="relative pb-8">
                                                {logIdx !== logs.length - 1 ? (
                                                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                                                ) : null}
                                                <div className="relative flex space-x-3">
                                                    <div>
                                                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${log.new_status === 'Completed' ? 'bg-green-500' :
                                                            log.new_status === 'Documents Ready' ? 'bg-blue-500' :
                                                                'bg-gray-400'
                                                            }`}>
                                                            <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                                                            </svg>
                                                        </span>
                                                    </div>
                                                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                                        <div>
                                                            <p className="text-sm text-gray-500">
                                                                Status changed to <span className="font-medium text-gray-900">{log.new_status}</span>
                                                            </p>
                                                            {log.old_status && (
                                                                <p className="text-xs text-gray-400">Previous: {log.old_status}</p>
                                                            )}
                                                        </div>
                                                        <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                                            <time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Extracted Data Modal */}
            {viewingData && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setViewingData(null)} />

                        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                                        <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">Extracted Data</h3>

                                        {editedData ? (
                                            <div className="space-y-4">
                                                {/* Common / Aadhaar Fields */}
                                                {editedData.name !== undefined && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Name</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                                            value={editedData.name || ''}
                                                            onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                                                        />
                                                    </div>
                                                )}
                                                {editedData.aadhaar_number !== undefined && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Aadhaar Number</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                                            value={editedData.aadhaar_number || ''}
                                                            onChange={(e) => setEditedData({ ...editedData, aadhaar_number: e.target.value })}
                                                        />
                                                    </div>
                                                )}

                                                {/* COI Fields */}
                                                {editedData.company_name !== undefined && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Company Name</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                                            value={editedData.company_name || ''}
                                                            onChange={(e) => setEditedData({ ...editedData, company_name: e.target.value })}
                                                        />
                                                    </div>
                                                )}
                                                {editedData.cin !== undefined && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">CIN</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                                            value={editedData.cin || ''}
                                                            onChange={(e) => setEditedData({ ...editedData, cin: e.target.value })}
                                                        />
                                                    </div>
                                                )}
                                                {editedData.pan !== undefined && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">PAN</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                                            value={editedData.pan || ''}
                                                            onChange={(e) => setEditedData({ ...editedData, pan: e.target.value })}
                                                        />
                                                    </div>
                                                )}
                                                {editedData.tan !== undefined && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">TAN</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                                            value={editedData.tan || ''}
                                                            onChange={(e) => setEditedData({ ...editedData, tan: e.target.value })}
                                                        />
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Address</label>
                                                    <textarea
                                                        rows={4}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                                        value={editedData.address || ''}
                                                        onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 italic">No data available.</p>
                                        )}

                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:flex sm:justify-between sm:px-6">
                                <div className="mt-3 sm:mt-0">
                                    <button
                                        type="button"
                                        className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
                                        onClick={() => {
                                            const name = editedData?.name || '';
                                            const address = editedData?.address || '';

                                            const text = `500 Rupees Stamp Paper

First Party
Director - Muhammed Shajar C
Loomian Developers Private Limited
10/1744, 1st Floor, Sowbhagya building, Athani, Kakkanad, Kusumagiri P.O, Kochi, 682030

Second Party
${name}
${address}`;

                                            navigator.clipboard.writeText(text).then(() => {
                                                addToast('Copied Agreement Parties to clipboard', 'success');
                                            }).catch(err => {
                                                console.error('Failed to copy', err);
                                                addToast('Failed to copy to clipboard', 'error');
                                            });
                                        }}
                                    >
                                        Agreement Parties
                                    </button>
                                </div>
                                <div className="sm:flex sm:flex-row-reverse gap-2">
                                    <button
                                        type="button"
                                        className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:w-auto disabled:opacity-50"
                                        onClick={handleUpdateExtractedData}
                                        disabled={extracting === viewingData.id}
                                    >
                                        {extracting === viewingData.id ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                                        onClick={async () => {
                                            await handleExtractData(viewingData);
                                        }}
                                        disabled={extracting === viewingData.id}
                                    >
                                        Re-extract
                                    </button>
                                    <button
                                        type="button"
                                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                                        onClick={() => setViewingData(null)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Action</h3>
                        <p className="text-sm text-gray-600 mb-4">{confirmMessage}</p>

                        {/* Display extracted data if available */}
                        {extractedDataPreview && (
                            <div className="bg-gray-50 rounded-md p-4 mb-4 max-h-64 overflow-y-auto">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">Extracted Data:</h4>
                                <dl className="space-y-2">
                                    {Object.entries(extractedDataPreview).map(([key, value]) => (
                                        <div key={key} className="flex justify-between text-sm">
                                            <dt className="font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}:</dt>
                                            <dd className="text-gray-900 ml-2">{String(value)}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    setConfirmAction(null);
                                    setExtractedDataPreview(null);
                                }}
                                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    if (confirmAction) {
                                        confirmAction();
                                    }
                                    setConfirmAction(null);
                                }}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
