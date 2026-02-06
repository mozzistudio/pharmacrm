import { useQuery } from '@tanstack/react-query';
import { omnichannelApi } from '../services/api';

export default function CampaignsPage() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await omnichannelApi.listCampaigns();
      return data.data as Array<Record<string, unknown>>;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Omnichannel Campaigns</h1>
        <button className="btn-primary">Create Campaign</button>
      </div>

      <div className="card mb-6 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          All email campaigns require <strong>compliance approval</strong> before scheduling.
          Only HCPs with active email consent will receive communications.
        </p>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading campaigns...</p>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id as string} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{campaign.name as string}</h3>
                  <p className="text-sm text-gray-500">Subject: {campaign.subject as string}</p>
                </div>
                <div className="flex items-center gap-3">
                  {campaign.compliance_approved ? (
                    <span className="badge-green">Approved</span>
                  ) : (
                    <span className="badge-yellow">Pending Approval</span>
                  )}
                  <span className={
                    campaign.status === 'sent' ? 'badge-green' :
                    campaign.status === 'scheduled' ? 'badge-blue' :
                    campaign.status === 'draft' ? 'badge bg-gray-100 text-gray-800' : 'badge-yellow'
                  }>
                    {campaign.status as string}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center text-gray-500">
          <p>No campaigns created yet.</p>
        </div>
      )}
    </div>
  );
}
