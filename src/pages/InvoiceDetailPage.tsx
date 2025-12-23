
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoice, createInvoiceItem, deleteInvoiceItem, getSubscription, updateInvoice, previewNextInvoiceNumber, updateInvoiceSequence } from '../services/api';
import type { Invoice, Subscription, InvoiceStatus } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ChevronLeftIcon, TrashIcon, PlusIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/logo.png';

export default function InvoiceDetailPage() {
    const { id, invoiceId } = useParams<{ id: string; invoiceId: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [addingItem, setAddingItem] = useState(false);

    // New Item State
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemAmount, setNewItemAmount] = useState(0);

    // Editing State
    const [status, setStatus] = useState<InvoiceStatus>('DRAFT');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [dueDate, setDueDate] = useState('');

    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (invoice) {
            setStatus(invoice.status);
            setInvoiceNumber(invoice.invoice_number || '');
            setInvoiceDate(invoice.invoice_date || '');
            setDueDate(invoice.due_date || '');
        }
    }, [invoice]);

    // Preview Next Invoice Number logic
    useEffect(() => {
        const fetchPreview = async () => {
            // Only fetch if draft, no number in DB, and no number typed in state (or standard check)
            // Actually, if we just loaded, invoiceNumber matches invoice.invoice_number.
            // If it's empty, we want to prefill.
            if (invoice && invoice.status === 'DRAFT' && !invoiceNumber && invoiceDate) {
                try {
                    const preview = await previewNextInvoiceNumber(invoiceDate);
                    // Only set if we still don't have one (concurrency check purely for react state)
                    setInvoiceNumber(prev => prev || preview);
                    setIsDirty(true);
                } catch (err) {
                    console.error('Failed to preview invoice number', err);
                }
            }
        };
        fetchPreview();
    }, [invoice, invoiceDate]); // re-run when date changes (FY change)

    const handleSave = async () => {
        if (!invoiceId || !invoice) return;
        try {
            await updateInvoice(invoiceId, {
                status: status,
                invoice_number: invoiceNumber || undefined,
                invoice_date: invoiceDate || undefined,
                due_date: dueDate || undefined
            });

            // Update Sequence
            if (invoiceNumber && invoiceDate) {
                await updateInvoiceSequence(invoiceDate, invoiceNumber);
            }
            await loadData();
            setIsDirty(false);
            addToast('Invoice saved successfully', 'success');
        } catch (err: any) {
            console.error(err);
            addToast('Failed to save invoice', 'error');
        }
    };

    useEffect(() => {
        loadData();
    }, [invoiceId]);

    const loadData = async () => {
        if (!invoiceId || !id) return;
        setLoading(true);
        try {
            const [invData, subData] = await Promise.all([
                getInvoice(invoiceId),
                getSubscription(id)
            ]);
            setInvoice(invData);
            setSubscription(subData);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load invoice', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async () => {
        if (!invoiceId || !newItemDesc || newItemAmount <= 0) return;

        try {
            await createInvoiceItem({
                invoice_id: invoiceId,
                description: newItemDesc,
                quantity: 1,
                unit_price: newItemAmount,
                amount: newItemAmount,
                revenue_nature: 'PASSTHROUGH', // Default
                gst_rate: 0,
                gst_amount: 0
            });
            // Reset and Reload
            setNewItemDesc('');
            setNewItemAmount(0);
            setAddingItem(false);
            await loadData();
            addToast('Item added', 'success');
        } catch (err: any) {
            console.error(err);
            addToast('Failed to add item', 'error');
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('Are you sure you want to remove this item?')) return;
        try {
            await deleteInvoiceItem(itemId);
            await loadData();
            addToast('Item removed', 'success');
        } catch (err: any) {
            console.error(err);
            addToast('Failed to delete item', 'error');
        }
    };

    const handleExportPDF = async () => {
        if (!invoice) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        // Helper to load image
        const getImageData = (url: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = url;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject('No context');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = reject;
            });
        };

        try {
            // -- Logo --
            const logoData = await getImageData(logo);
            // Image is logo.png. I'll use fixed size.
            doc.addImage(logoData, 'PNG', 14, 10, 50, 18);

            // -- Header Right --
            doc.setFontSize(24);
            doc.setTextColor(0); // Indigo
            doc.text('INVOICE', pageWidth - 14, 22, { align: 'right' });

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`# ${invoice.invoice_number || 'DRAFT'}`, pageWidth - 14, 30, { align: 'right' });


            // -- Company Info (Left under logo) --
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text('Loomian Developers Private Limited', 14, 35);
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('10/1744, 1st Floor, Sowbhagya building, Athani', 14, 40);
            doc.text('Kakkanad, Kochi, 682030, Kerala, India', 14, 44);
            doc.text('kommonspace@gmail.com', 14, 48);
            doc.text('www.kommonspace.com', 14, 52);

            // -- Divider --
            doc.setDrawColor(200);
            doc.line(14, 55, pageWidth - 14, 55);

            // -- Client & Dates Section --
            const startY = 65;

            // Bill To
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text('Bill To:', 14, startY);
            doc.setFontSize(10);
            doc.text(subscription?.users?.name || 'Client Name', 14, startY + 6);

            let billToY = startY + 11;

            if (subscription?.suite_number) {
                doc.setTextColor(100);
                doc.text(`Suite ${subscription.suite_number}`, 14, billToY);
                billToY += 5;
            }

            const userAddress = subscription?.signatory_type === 'company'
                ? subscription?.subscription_companies?.address
                : subscription?.subscription_signatories?.address;

            if (userAddress) {
                doc.setTextColor(100);
                const splitAddress = doc.splitTextToSize(userAddress, 80);
                doc.text(splitAddress, 14, billToY);
                billToY += (splitAddress.length * 5);
            }

            // Invoice Details (Right)
            doc.setTextColor(0);
            doc.text('Date:', pageWidth - 60, startY);
            doc.text(format(new Date(invoice.invoice_date || new Date()), 'dd-MM-yyyy'), pageWidth - 14, startY, { align: 'right' });

            doc.text('Due Date:', pageWidth - 60, startY + 6);
            doc.text(invoice.due_date || '-', pageWidth - 14, startY + 6, { align: 'right' });

            // -- Table --
            const tableBody = invoice.invoice_items?.map(item => {
                const isVO = (item.subscription_items as any)?.item_type === 'VO' || item.subscription_items?.services?.code === 'VO';
                let description = isVO ? `Virtual Office ${item.description}` : item.description;

                if (item.revenue_nature === 'PASSTHROUGH') {
                    description += ' (Reimbursement at actuals)';
                }

                return [
                    description,
                    item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                    '1',
                    item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                ];
            }) || [];

            const tableStartY = Math.max(billToY + 5, startY + 20);

            autoTable(doc, {
                startY: tableStartY,
                head: [[
                    'Description',
                    { content: 'Rate', styles: { halign: 'right' } },
                    { content: 'Qty', styles: { halign: 'right' } },
                    { content: 'Total', styles: { halign: 'right' } }
                ]],
                body: tableBody,
                theme: 'grid',
                headStyles: {
                    fillColor: [67, 56, 202], // Indigo-700
                    textColor: 255,
                    fontStyle: 'bold'
                },
                columnStyles: {
                    0: { cellWidth: 'auto' }, // Description
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right', fontStyle: 'bold' }
                },
                footStyles: {
                    fillColor: [245, 245, 245],
                    textColor: 0,
                    fontStyle: 'bold'
                }
            });

            // -- Totals --
            // @ts-ignore
            let finalY = doc.lastAutoTable.finalY + 10;
            const rightColX = pageWidth - 14;
            const labelColX = pageWidth - 60;

            const subtotal = invoice.invoice_items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
            const tax = invoice.invoice_items?.reduce((sum, item) => sum + (item.gst_amount || 0), 0) || 0;
            const total = subtotal + tax;

            doc.setFontSize(10);
            doc.setTextColor(100);

            doc.text('Subtotal:', labelColX, finalY);
            doc.text(`INR ${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightColX, finalY, { align: 'right' });

            // finalY += 6;
            // doc.text('Tax (GST):', labelColX, finalY);
            // doc.text(`INR ${tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightColX, finalY, { align: 'right' });

            finalY += 6;
            doc.setDrawColor(200);
            doc.line(labelColX, finalY, rightColX, finalY);

            finalY += 8;
            doc.setFontSize(14);
            doc.setTextColor(0); // Black
            doc.text('Total:', labelColX, finalY);
            doc.setTextColor(79, 70, 229); // Indigo
            doc.text(`INR ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightColX, finalY, { align: 'right' });

            finalY += 8;
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text('Paid Amount:', labelColX, finalY);
            doc.text(`INR ${(subscription?.received_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightColX, finalY, { align: 'right' });

            // -- Pricing Note --
            doc.setFontSize(8);
            doc.setTextColor(100);
            const note = "The standard Virtual Office plan is priced at INR 9000 per year, and the Professional Virtual Office plan is priced at INR 11000 per year. Any discount offered on the Virtual Office service is applicable only for the first year. From the second year onwards, the subscription will be renewed at the prevailing standard rate of the selected plan.";

            // Calculate Y position for the note (above footer)
            // Footer is at height - 20, let's place this above it
            const splitNote = doc.splitTextToSize(note, pageWidth - 28);
            const noteHeight = splitNote.length * 4; // approx height
            const noteY = doc.internal.pageSize.height - 25 - noteHeight;

            doc.text(splitNote, 14, noteY);

            // -- Footer --
            const footerY = doc.internal.pageSize.height - 20;
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
            doc.setFontSize(8);
            doc.text('KommonSpace - Virtual Office and Managed Office Solutions', pageWidth / 2, footerY + 5, { align: 'center' });

            // -- Save --
            doc.save(`Invoice_${invoice.invoice_number || 'draft'}.pdf`);

        } catch (error) {
            console.error('PDF Generation Error:', error);
            addToast('Failed to generate PDF', 'error');
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

    const isDraft = invoice.status === 'DRAFT';

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
                                <ChevronLeftIcon className="h-6 w-6" />
                            </button>
                            <div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        placeholder="Invoice Number"
                                        className="text-3xl font-bold tracking-tight text-gray-900 border-none p-0 focus:ring-0 placeholder:text-gray-400 bg-transparent"
                                        value={invoiceNumber}
                                        onChange={(e) => {
                                            setInvoiceNumber(e.target.value);
                                            setIsDirty(true);
                                        }}
                                    />
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-medium ring-1 ring-inset ring-gray-500/10 ${isDraft ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                        {invoice.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleExportPDF}
                                className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                                <ArrowDownTrayIcon className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                                Export PDF
                            </button>
                            <div>
                                <label htmlFor="invoice_date" className="block text-xs font-medium text-gray-500">Invoice Date</label>
                                <input
                                    type="date"
                                    id="invoice_date"
                                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    value={invoiceDate}
                                    onChange={(e) => {
                                        setInvoiceDate(e.target.value);
                                        setIsDirty(true);
                                    }}
                                />
                            </div>
                            <div>
                                <label htmlFor="due_date" className="block text-xs font-medium text-gray-500">Due Date</label>
                                <input
                                    type="date"
                                    id="due_date"
                                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    value={dueDate}
                                    onChange={(e) => {
                                        setDueDate(e.target.value);
                                        setIsDirty(true);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Invoice Details & Items */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Client Info Card */}
                        <div className="bg-white px-4 py-5 shadow sm:rounded-lg sm:p-6">
                            <h3 className="text-base font-semibold leading-6 text-gray-900">Billed To</h3>
                            <div className="mt-2 text-sm text-gray-600">
                                <p className="font-medium text-gray-900">{subscription?.users?.name}</p>
                                <p>Suite {subscription?.suite_number}</p>
                                {/* Add more client details if available */}
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                            <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-gray-50">
                                <h3 className="text-base font-semibold leading-6 text-gray-900">Line Items</h3>
                            </div>
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Description</th>
                                        <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Amount</th>
                                        <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {invoice.invoice_items?.map((item) => (
                                        <tr key={item.id}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">
                                                {item.description}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right font-mono">
                                                ₹{item.amount.toLocaleString('en-IN')}
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                {isDraft && (
                                                    <button onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:text-red-900">
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Add Item Row */}
                                    {isDraft && addingItem && (
                                        <tr className="bg-gray-50">
                                            <td className="p-2 pl-6">
                                                <input
                                                    type="text"
                                                    placeholder="Description"
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                    value={newItemDesc}
                                                    onChange={(e) => setNewItemDesc(e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    placeholder="Amount"
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-right"
                                                    value={newItemAmount}
                                                    onChange={(e) => setNewItemAmount(parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td className="p-2 text-right pr-6">
                                                <button onClick={handleAddItem} className="text-indigo-600 hover:text-indigo-900 mr-2">Save</button>
                                                <button onClick={() => setAddingItem(false)} className="text-gray-500 hover:text-gray-700">Cancel</button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            {isDraft && !addingItem && (
                                <div className="bg-gray-50 px-4 py-3 text-right sm:px-6">
                                    <button
                                        onClick={() => setAddingItem(true)}
                                        className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                    >
                                        <PlusIcon className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                                        Add Line Item
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Summary & Action */}
                    <div className="space-y-6">
                        <div className="bg-white px-4 py-5 shadow sm:rounded-lg sm:p-6">
                            <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">Summary</h3>
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Subtotal</dt>
                                    <dd className="font-medium text-gray-900">
                                        ₹{((invoice.invoice_items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0)).toLocaleString('en-IN')}
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-gray-500">Tax</dt>
                                    <dd className="font-medium text-gray-900">
                                        ₹{((invoice.invoice_items?.reduce((sum, item) => sum + (item.gst_amount || 0), 0) || 0)).toLocaleString('en-IN')}
                                    </dd>
                                </div>
                                <div className="flex justify-between border-t border-gray-200 pt-3">
                                    <dt className="font-semibold text-gray-900">Total</dt>
                                    <dd className="font-bold text-indigo-600 text-lg">
                                        ₹{((invoice.invoice_items?.reduce((sum, item) => sum + (item.amount || 0) + (item.gst_amount || 0), 0) || 0)).toLocaleString('en-IN')}
                                    </dd>
                                </div>
                            </dl>

                            <div className="mt-6 border-t border-gray-200 pt-4">
                                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                                <select
                                    id="status"
                                    name="status"
                                    className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                    value={status}
                                    onChange={(e) => {
                                        setStatus(e.target.value as InvoiceStatus);
                                        setIsDirty(true);
                                    }}
                                >
                                    <option value="DRAFT">Draft</option>
                                    <option value="ISSUED">Issued</option>
                                    <option value="wo_tax">Without Tax(Temp)</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>

                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!isDirty}
                                    className={`w-full rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${isDirty ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-gray-300 cursor-not-allowed'}`}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
