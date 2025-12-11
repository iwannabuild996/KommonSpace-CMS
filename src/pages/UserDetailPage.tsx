import { useParams } from 'react-router-dom';

export default function UserDetailPage() {
    const { id } = useParams();
    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">User Detail: {id}</h2>
            <p>Detailed view of a specific user and their subscriptions.</p>
        </div>
    );
}
