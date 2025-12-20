import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubscription, updateSubscription, getSubscriptionLogs, uploadSubscriptionFile, getSubscriptionFiles, extractSubscriptionData, updateSubscriptionFile, updateSubscriptionSignatory, updateSubscriptionCompany, getPlans, getUsers, getPayments, getAdminUsers } from '../services/api';
import type { SubscriptionStatus, RubberStampStatus, NameBoardStatus, SubscriptionFile, SubscriptionFileLabel, Payment } from '../services/api';
import { useToast } from '../hooks/useToast';
import { supabase } from '../services/supabase';
import SuffixSelectionModal from '../components/SuffixSelectionModal';
import AddPaymentModal from '../components/AddPaymentModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    const [plans, setPlans] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [adminUsers, setAdminUsers] = useState<any[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);

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

    // Company Edit State
    const [isEditingCompany, setIsEditingCompany] = useState(false);

    // Information Edit State
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [infoEditData, setInfoEditData] = useState<any>({});
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // Documents Edit State
    const [isEditingDocuments, setIsEditingDocuments] = useState(false);
    const [documentsEditData, setDocumentsEditData] = useState<any>({});
    const [showSuffixModal, setShowSuffixModal] = useState(false);

    // Payments State
    const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);

    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [extractedDataPreview, setExtractedDataPreview] = useState<any>(null);

    // Edit State
    const [status, setStatus] = useState<SubscriptionStatus>('Advance Received');
    const [rubberStamp, setRubberStamp] = useState<RubberStampStatus>('Not Available');
    const [nameBoard, setNameBoard] = useState<NameBoardStatus>('Not Available');

    // File Upload State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileLabel, setFileLabel] = useState<SubscriptionFileLabel>('Others');

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [subData, logsData, filesData, plansData, usersData, paymentsData, adminUsersData] = await Promise.all([
                getSubscription(id),
                getSubscriptionLogs(id),
                getSubscriptionFiles(id),
                getPlans(),
                getUsers(),
                getPayments(id),
                getAdminUsers()
            ]);
            setSubscription(subData);
            setLogs(logsData as any[]);
            setFiles(filesData);
            setPlans(plansData);
            setUsers(usersData);
            setPayments(paymentsData);
            setAdminUsers(adminUsersData);

            // Initialize edit state
            if (subData) {
                setStatus(subData.status);
                setRubberStamp(subData.rubber_stamp || 'Not Available');
                setNameBoard(subData.name_board || 'Not Available');
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
                rubber_stamp: rubberStamp,
                name_board: nameBoard
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

            // Upload Aadhaar file if provided and update signatory data with file info
            if (aadhaarFile) {
                const uploadedFile = await uploadSubscriptionFile(id, aadhaarFile, 'Signatory Aadhaar');
                signatoryUpdates.aadhaar_file_path = uploadedFile.file_path;
                signatoryUpdates.aadhaar_file_name = uploadedFile.file_name;
            }

            // Update Signatory Data
            await updateSubscriptionSignatory(id, signatoryUpdates);

            addToast('Signatory details updated successfully', 'success');
            setIsEditingSignatory(false);
            setAadhaarFile(null);
            fetchData(); // Refresh data
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to update signatory details', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleGenerateDocuments = async (suffix: string) => {
        setUpdating(true);
        try {
            const plan = plans.find(p => p.id === subscription.plan_id);
            const user = users.find(u => u.id === subscription.user_id);

            if (!plan || !plan.tag) {
                throw new Error('Plan tag is required for document generation');
            }

            if (!subscription.subscription_signatories) {
                throw new Error('Signatory details are required');
            }

            if (!subscription.subscription_companies && subscription.signatory_type === 'company') {
                throw new Error('Company details are required for company signatory type');
            }

            const startDate = subscription.start_date ? new Date(subscription.start_date) : new Date();
            const dateString = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const dateFormatted = startDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

            let activitiesJoined = 'General business activities';
            if (subscription.activities && subscription.activities.length > 0) {
                if (subscription.activities.length === 1) {
                    activitiesJoined = subscription.activities[0];
                } else if (subscription.activities.length === 2) {
                    activitiesJoined = subscription.activities.join(' and ');
                } else {
                    const lastActivity = subscription.activities[subscription.activities.length - 1];
                    const otherActivities = subscription.activities.slice(0, -1);
                    activitiesJoined = otherActivities.join(', ') + ', and ' + lastActivity;
                }
            }

            const activityText = `The client is permitted to use the office address solely for administrative purposes related to ${activitiesJoined}. Any additional business activities require prior written approval from Loomian.`;

            const payload = {
                plan: plan.tag,
                date_string: dateString,
                date: dateFormatted,
                suite_number: subscription.suite_number || '',
                company_name: subscription.subscription_companies?.name || user?.name || '',
                company_address: subscription.subscription_companies?.address || '',
                suffix: suffix,
                client_name: subscription.subscription_signatories.name || '',
                client_name_with_suffix: subscription.subscription_signatories.name || '',
                activity: activityText,
                client_address: subscription.subscription_signatories.address || '',
                client_aadhaar_number: subscription.subscription_signatories.aadhaar_number || '',
                license_fee: subscription.purchase_amount?.toString() || '0',
                signatory_designation: subscription.subscription_signatories.designation || '',
                signatory_type: subscription.signatory_type || 'individual'
            };

            console.log('Generating documents with payload:', payload);

            const { data, error } = await supabase.functions.invoke('generate-documents', {
                body: payload
            });

            if (error) throw error;

            console.log('Documents generated:', data);

            await updateSubscription(id!, {
                br_pdf_url: data.br_pdf_url,
                br_doc_url: data.br_doc_url,
                ll_pdf_url: data.ll_pdf_url,
                ll_doc_url: data.ll_doc_url,
                drive_folder_url: data.folder_url
            });

            addToast('Documents generated successfully', 'success');
            fetchData();
        } catch (error: any) {
            console.error('Document generation error:', error);
            addToast(error.message || 'Failed to generate documents', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleCopyPaperContent = async () => {
        if (!subscription) return;

        const signatoryName = subscription.subscription_signatories?.name || '________________';
        const userPhone = subscription.users?.phone || '________________';

        let secondPartyDetails = '';

        if (subscription.signatory_type === 'company') {
            const signatoryDesignation = subscription.subscription_signatories?.designation || '';
            const companyName = subscription.subscription_companies?.name || '________________';
            const companyAddress = subscription.subscription_companies?.address || '________________';

            secondPartyDetails = `${signatoryDesignation} ${signatoryName}
${companyName}
${companyAddress}
${userPhone}`;
        } else {
            // Individual
            const signatoryAddress = subscription.subscription_signatories?.address || '________________';
            secondPartyDetails = `${signatoryName}
${signatoryAddress}
${userPhone}`;
        }

        const textToCopy = `500 Rupees Stamp Paper

First Party
Director - Muhammed Shajar C
Loomian Developers Private Limited
10/1744, 1st Floor, Sowbhagya building, Athani, Kakkanad, Kusumagiri P.O, Kochi, 682030

Second Party
${secondPartyDetails}`;

        try {
            await navigator.clipboard.writeText(textToCopy);
            addToast('Paper content copied to clipboard', 'success');
        } catch (err) {
            console.error('Failed to copy: ', err);
            addToast('Failed to copy content', 'error');
        }
    };

    const handleDownloadReceipt = (payment: Payment) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229); // Indigo 600
        doc.text('PAYMENT RECEIPT', 105, 20, { align: 'center' });

        // Company Info
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Loomian Developers Private Limited', 105, 30, { align: 'center' });
        doc.text('Kakkanad, Kochi, Kerala, 682030', 105, 35, { align: 'center' });

        // Divider
        doc.setLineWidth(0.5);
        doc.setDrawColor(200);
        doc.line(20, 45, 190, 45);

        // Receipt Details
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Receipt ID: #${payment.id}`, 20, 60);
        doc.text(`Date: ${new Date(payment.payment_date).toLocaleDateString()}`, 140, 60);

        // Client Info
        doc.setFontSize(14);
        doc.text('Received From:', 20, 80);
        doc.setFontSize(11);
        doc.setTextColor(50);

        const clientName = subscription.subscription_companies?.name || subscription.users?.name || 'Valued Client';
        const clientPhone = subscription.users?.phone || '';
        const suite = subscription.suite_number ? `Suite #${subscription.suite_number}` : '';

        doc.text(clientName, 20, 90);
        if (clientPhone) doc.text(clientPhone, 20, 96);
        if (suite) doc.text(suite, 20, 102);

        // Payment Table
        autoTable(doc, {
            startY: 115,
            head: [['Description', 'Payment Mode', 'Amount']],
            body: [
                [
                    `Subscription Payment - ${subscription.plans?.name || 'Plan'}`,
                    payment.payment_type || 'Bank Transfer',
                    `INR ${payment.amount.toLocaleString()}`
                ]
            ],
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] },
        });

        // Total
        const finalY = (doc as any).lastAutoTable.finalY || 150;
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Total Amount Paid: INR ${payment.amount.toLocaleString()}`, 140, finalY + 15, { align: 'right' });

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('Thank you for your business!', 105, 250, { align: 'center' });

        // Recorded By
        const recorderName = (() => {
            const admin = adminUsers.find(u => u.user_id === payment.added_by);
            return admin?.name || 'System';
        })();
        doc.setFontSize(9);
        doc.text(`Recorded by: ${recorderName}`, 20, 270);

        doc.save(`receipt_${payment.id}.pdf`);
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



                    {/* Details Card */}
                    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-semibold leading-6 text-gray-900">Information</h3>
                                <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about the subscription and signatory.</p>
                            </div>
                            {!isEditingInfo && (
                                <button
                                    onClick={() => {
                                        setIsEditingInfo(true);
                                        setInfoEditData({
                                            user_id: subscription.user_id,
                                            plan_id: subscription.plan_id,
                                            signatory_type: subscription.signatory_type,
                                            suite_number: subscription.suite_number,
                                            purchased_date: subscription.purchased_date,
                                            start_date: subscription.start_date,
                                            expiry_date: subscription.expiry_date,
                                            purchase_amount: subscription.purchase_amount,
                                            received_amount: subscription.received_amount,
                                            activities: subscription.activities || []
                                        });
                                    }}
                                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="border-t border-gray-100">
                            {!isEditingInfo ? (
                                <>
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
                                        <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                            <dt className="text-sm font-medium text-gray-900">Activities</dt>
                                            <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                                {subscription.activities && subscription.activities.length > 0 ? (
                                                    <ul className="space-y-1">
                                                        {subscription.activities.map((activity: string, index: number) => (
                                                            <li key={index} className="flex items-start">
                                                                <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                                                    {activity}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className="text-gray-500">No activities</span>
                                                )}
                                            </dd>
                                        </div>
                                    </dl>
                                    <div className="border-t border-gray-100 px-4 py-4 sm:px-6">
                                        <button
                                            type="button"
                                            onClick={handleCopyPaperContent}
                                            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                        >
                                            Paper Content
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">User</label>
                                            <input
                                                type="text"
                                                placeholder="Search users..."
                                                value={userSearchQuery}
                                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border mb-2"
                                            />
                                            <select
                                                value={infoEditData.user_id || ''}
                                                onChange={(e) => setInfoEditData({ ...infoEditData, user_id: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                size={5}
                                            >
                                                <option value="">Select a user</option>
                                                {users
                                                    .filter(user =>
                                                        user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                                        (user.phone && user.phone.includes(userSearchQuery)) ||
                                                        (user.email && user.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                                    )
                                                    .map((user) => (
                                                        <option key={user.id} value={user.id}>
                                                            {user.name} {user.phone ? `(${user.phone})` : ''}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Plan</label>
                                            <select
                                                value={infoEditData.plan_id || ''}
                                                onChange={(e) => setInfoEditData({ ...infoEditData, plan_id: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            >
                                                <option value="">Select a plan</option>
                                                {plans.map((plan) => (
                                                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Signatory Type</label>
                                            <select
                                                value={infoEditData.signatory_type || ''}
                                                onChange={(e) => setInfoEditData({ ...infoEditData, signatory_type: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            >
                                                <option value="individual">Individual</option>
                                                <option value="company">Company</option>
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Suite Number</label>
                                            <input
                                                type="text"
                                                value={infoEditData.suite_number || ''}
                                                onChange={(e) => setInfoEditData({ ...infoEditData, suite_number: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Purchased Date</label>
                                            <input
                                                type="date"
                                                value={infoEditData.purchased_date || ''}
                                                onChange={(e) => setInfoEditData({ ...infoEditData, purchased_date: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                            <input
                                                type="date"
                                                value={infoEditData.start_date || ''}
                                                onChange={(e) => setInfoEditData({ ...infoEditData, start_date: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
                                            <input
                                                type="date"
                                                value={infoEditData.expiry_date || ''}
                                                onChange={(e) => setInfoEditData({ ...infoEditData, expiry_date: e.target.value })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Purchase Amount (₹)</label>
                                            <input
                                                type="number"
                                                value={infoEditData.purchase_amount || ''}
                                                onChange={(e) => setInfoEditData({ ...infoEditData, purchase_amount: parseFloat(e.target.value) })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Received Amount (₹)</label>
                                            <input
                                                type="number"
                                                value={infoEditData.received_amount || ''}
                                                onChange={(e) => setInfoEditData({ ...infoEditData, received_amount: parseFloat(e.target.value) })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                    </div>

                                    {/* Activities Management */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Activities</label>
                                        <div className="space-y-2">
                                            {infoEditData.activities && infoEditData.activities.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {infoEditData.activities.map((activity: string, index: number) => (
                                                        <span key={index} className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                                            {activity}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newActivities = infoEditData.activities.filter((_: string, i: number) => i !== index);
                                                                    setInfoEditData({ ...infoEditData, activities: newActivities });
                                                                }}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Add new activity..."
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                            e.preventDefault();
                                                            const newActivity = e.currentTarget.value.trim();
                                                            const currentActivities = infoEditData.activities || [];
                                                            setInfoEditData({ ...infoEditData, activities: [...currentActivities, newActivity] });
                                                            e.currentTarget.value = '';
                                                        }
                                                    }}
                                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                        if (input && input.value.trim()) {
                                                            const newActivity = input.value.trim();
                                                            const currentActivities = infoEditData.activities || [];
                                                            setInfoEditData({ ...infoEditData, activities: [...currentActivities, newActivity] });
                                                            input.value = '';
                                                        }
                                                    }}
                                                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => setIsEditingInfo(false)}
                                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setUpdating(true);
                                                try {
                                                    await updateSubscription(id!, infoEditData);
                                                    addToast('Information updated successfully', 'success');
                                                    setIsEditingInfo(false);
                                                    fetchData();
                                                } catch (error: any) {
                                                    console.error(error);
                                                    addToast(error.message || 'Failed to update information', 'error');
                                                } finally {
                                                    setUpdating(false);
                                                }
                                            }}
                                            disabled={updating}
                                            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                                        >
                                            {updating ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>



                    {/* Company Details Card */}
                    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-semibold leading-6 text-gray-900">Company Details</h3>
                                <p className="mt-1 max-w-2xl text-sm text-gray-500">Information about the company.</p>
                            </div>
                            {!isEditingCompany && (
                                <button
                                    onClick={() => {
                                        setIsEditingCompany(true);
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
                            {!isEditingCompany ? (
                                <dl className="divide-y divide-gray-100">
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">Company Name</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0 font-semibold">{subscription.subscription_companies?.name || '-'}</dd>
                                    </div>
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">CIN</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.subscription_companies?.cin || '-'}</dd>
                                    </div>
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">PAN</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.subscription_companies?.pan || '-'}</dd>
                                    </div>
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">TAN</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.subscription_companies?.tan || '-'}</dd>
                                    </div>
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">Company Address</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{subscription.subscription_companies?.address || '-'}</dd>
                                    </div>
                                    {subscription.subscription_companies?.coi_file_name && (
                                        <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
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
                                                        className="text-indigo-600 hover:text-indigo-900 cursor-pointer"
                                                        title="Download COI file"
                                                    >
                                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </a>
                                                    <button
                                                        onClick={async () => {
                                                            setUpdating(true);
                                                            try {
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
                                                        className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {updating && (
                                                            <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        )}
                                                        {updating ? 'Extracting...' : 'Extract Data'}
                                                    </button>
                                                </div>
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            ) : (
                                <div className="p-6 space-y-6">
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

                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => {
                                                setIsEditingCompany(false);
                                                setCoiFile(null);
                                            }}
                                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setUpdating(true);
                                                try {
                                                    const companyUpdates: any = { ...companyEditData };

                                                    if (coiFile) {
                                                        const uploadedFile = await uploadSubscriptionFile(id!, coiFile, 'Certificate of Incorporation');
                                                        companyUpdates.coi_file_path = uploadedFile.file_path;
                                                        companyUpdates.coi_file_name = uploadedFile.file_name;
                                                    }

                                                    await updateSubscriptionCompany(id!, companyUpdates);
                                                    addToast('Company details updated successfully', 'success');
                                                    setIsEditingCompany(false);
                                                    setCoiFile(null);
                                                    fetchData();
                                                } catch (error: any) {
                                                    console.error(error);
                                                    addToast(error.message || 'Failed to update company details', 'error');
                                                } finally {
                                                    setUpdating(false);
                                                }
                                            }}
                                            disabled={updating}
                                            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                                        >
                                            {updating ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

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

                                <div className="sm:col-span-3">
                                    <label htmlFor="name_board" className="block text-sm font-medium leading-6 text-gray-900">Name Board</label>
                                    <div className="mt-2">
                                        <select
                                            id="name_board"
                                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                            value={nameBoard}
                                            onChange={(e) => setNameBoard(e.target.value as NameBoardStatus)}
                                        >
                                            <option value="Not Available">Not Available</option>
                                            <option value="Available">Available</option>
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
                </div>

                {/* Right Column: Files & Timeline */}
                <div className="space-y-6">

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
                                                        className="text-indigo-600 hover:text-indigo-900 cursor-pointer"
                                                        title="Download Aadhaar file"
                                                    >
                                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </a>
                                                    <button
                                                        onClick={async () => {
                                                            setUpdating(true);
                                                            try {
                                                                // Extract data first
                                                                // Find the file record to get the correct mime type
                                                                const filePath = subscription.subscription_signatories!.aadhaar_file_path!;
                                                                const fileRecord = files.find(f => f.file_path === filePath);
                                                                let mimeType = fileRecord?.mime_type;

                                                                // Fallback to extension if file record or mime type is missing
                                                                if (!mimeType) {
                                                                    const ext = filePath.split('.').pop()?.toLowerCase();
                                                                    if (ext === 'png') mimeType = 'image/png';
                                                                    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                                                                    else mimeType = 'application/pdf';
                                                                }

                                                                const extracted = await extractSubscriptionData(
                                                                    filePath,
                                                                    mimeType,
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
                                                        className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {updating && (
                                                            <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        )}
                                                        {updating ? 'Extracting...' : 'Extract Data'}
                                                    </button>
                                                </div>
                                            </dd>
                                        </div>
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

                    {/* Documents Card */}
                    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-semibold leading-6 text-gray-900">Documents</h3>
                            </div>
                            <div className="flex gap-2">
                                {!isEditingDocuments && (
                                    <>
                                        <button
                                            onClick={() => setShowSuffixModal(true)}
                                            disabled={updating}
                                            className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
                                        >
                                            {updating ? 'Generating...' : 'Generate'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditingDocuments(true);
                                                setDocumentsEditData({
                                                    br_pdf_url: subscription.br_pdf_url || '',
                                                    br_doc_url: subscription.br_doc_url || '',
                                                    ll_pdf_url: subscription.ll_pdf_url || '',
                                                    ll_doc_url: subscription.ll_doc_url || '',
                                                });
                                            }}
                                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                        >
                                            Edit
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="border-t border-gray-100">
                            {!isEditingDocuments ? (
                                <dl className="divide-y divide-gray-100">
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">BR NOC PDF</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                            {subscription.br_pdf_url ? (
                                                <a
                                                    href={subscription.br_pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 hover:bg-blue-100 cursor-pointer transition-colors"
                                                >
                                                    <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    View PDF
                                                </a>
                                            ) : '-'}
                                        </dd>
                                    </div>
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">BR NOC Document</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                            {subscription.br_doc_url ? (
                                                <a
                                                    href={subscription.br_doc_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center rounded-md bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-700/10 hover:bg-green-100 cursor-pointer transition-colors"
                                                >
                                                    <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    View Document
                                                </a>
                                            ) : '-'}
                                        </dd>
                                    </div>
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">License Agreement PDF</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                            {subscription.ll_pdf_url ? (
                                                <a
                                                    href={subscription.ll_pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center rounded-md bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10 hover:bg-purple-100 cursor-pointer transition-colors"
                                                >
                                                    <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    View PDF
                                                </a>
                                            ) : '-'}
                                        </dd>
                                    </div>
                                    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                        <dt className="text-sm font-medium text-gray-900">License Agreement Document</dt>
                                        <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                            {subscription.ll_doc_url ? (
                                                <a
                                                    href={subscription.ll_doc_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center rounded-md bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 ring-1 ring-inset ring-orange-700/10 hover:bg-orange-100 cursor-pointer transition-colors"
                                                >
                                                    <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    View Document
                                                </a>
                                            ) : '-'}
                                        </dd>
                                    </div>
                                </dl>
                            ) : (
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">BR NOC PDF URL</label>
                                            <input
                                                type="url"
                                                value={documentsEditData.br_pdf_url || ''}
                                                onChange={(e) => setDocumentsEditData({ ...documentsEditData, br_pdf_url: e.target.value })}
                                                placeholder="https://..."
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">BR NOC Document URL</label>
                                            <input
                                                type="url"
                                                value={documentsEditData.br_doc_url || ''}
                                                onChange={(e) => setDocumentsEditData({ ...documentsEditData, br_doc_url: e.target.value })}
                                                placeholder="https://..."
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">License Agreement PDF URL</label>
                                            <input
                                                type="url"
                                                value={documentsEditData.ll_pdf_url || ''}
                                                onChange={(e) => setDocumentsEditData({ ...documentsEditData, ll_pdf_url: e.target.value })}
                                                placeholder="https://..."
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">License Agreement Document URL</label>
                                            <input
                                                type="url"
                                                value={documentsEditData.ll_doc_url || ''}
                                                onChange={(e) => setDocumentsEditData({ ...documentsEditData, ll_doc_url: e.target.value })}
                                                placeholder="https://..."
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => setIsEditingDocuments(false)}
                                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setUpdating(true);
                                                try {
                                                    await updateSubscription(id!, documentsEditData);
                                                    addToast('Documents updated successfully', 'success');
                                                    setIsEditingDocuments(false);
                                                    fetchData();
                                                } catch (error: any) {
                                                    console.error(error);
                                                    addToast(error.message || 'Failed to update documents', 'error');
                                                } finally {
                                                    setUpdating(false);
                                                }
                                            }}
                                            disabled={updating}
                                            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                                        >
                                            {updating ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payments Card */}
                    <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
                            <div>
                                <h3 className="text-base font-semibold leading-6 text-gray-900">Payments</h3>
                                <p className="mt-1 max-w-2xl text-sm text-gray-500">Track payments for this subscription.</p>
                            </div>
                            <button
                                onClick={() => setIsAddPaymentModalOpen(true)}
                                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                            >
                                Add Payment
                            </button>
                        </div>
                        <div className="px-4 py-5 sm:p-6">
                            {payments.length === 0 ? (
                                <p className="text-sm text-gray-500">No payments recorded.</p>
                            ) : (
                                <div className="space-y-4">
                                    {payments.map((payment) => (
                                        <div key={payment.id} className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                            <div>
                                                <p className="font-semibold text-gray-900">₹{payment.amount.toLocaleString()}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span>{payment.payment_type || 'Bank Transfer'}</span>
                                                    <span>•</span>
                                                    <span>Recorded by {(() => {
                                                        const admin = adminUsers.find(u => u.user_id === payment.added_by);
                                                        return admin?.name || 'Unknown';
                                                    })()}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-700">{new Date(payment.payment_date).toLocaleDateString()}</p>
                                                <p className="text-xs text-gray-400">ID: {payment.id}</p>
                                                <button
                                                    onClick={() => handleDownloadReceipt(payment)}
                                                    className="inline-flex items-center gap-1 mt-1 text-indigo-600 hover:text-indigo-500 text-xs font-medium"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.69l-2.22-2.22a.75.75 0 10-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l3.5-3.5a.75.75 0 00-1.06-1.06l-2.22 2.22V6.75z" clipRule="evenodd" />
                                                    </svg>
                                                    Receipt
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

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
                                            <div className="ml-4 flex min-w-0 flex-1 flex-col gap-1">
                                                <span className="truncate font-medium text-gray-900">{file.file_name}</span>
                                                <span className="text-xs text-gray-500">({file.label})</span>
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
            {
                viewingData && (
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
                )
            }

            {/* Confirmation Modal */}
            {
                showConfirmModal && (
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
                )
            }

            <SuffixSelectionModal
                isOpen={showSuffixModal}
                onClose={() => setShowSuffixModal(false)}
                onSelect={(suffix: string) => {
                    handleGenerateDocuments(suffix);
                    setShowSuffixModal(false);
                }}
            />
            {/* Payments Modal */}
            <AddPaymentModal
                subscriptionId={id || ''}
                userId={subscription?.user_id || ''}
                isOpen={isAddPaymentModalOpen}
                onClose={() => setIsAddPaymentModalOpen(false)}
                onSuccess={() => fetchData()}
            />
        </div >
    );
}
