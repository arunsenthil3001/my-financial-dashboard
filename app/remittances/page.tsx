import RemittancesClient from '@/components/remittances/RemittancesClient';

export default function RemittancesPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-5">Transfers</h1>
      <RemittancesClient />
    </div>
  );
}
