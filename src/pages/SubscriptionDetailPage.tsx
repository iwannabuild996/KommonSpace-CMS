import { useParams } from 'react-router-dom';

export default function SubscriptionDetailPage() {
    const { id } = useParams();
    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Subscription Detail: {id}</h2>
            <p>Manage subscription lifecycle, view logs, and update status.</p>
        </div>
    );
}
