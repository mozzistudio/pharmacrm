import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { engagementApi } from '../services/api';
import type { Interaction, PaginatedResponse } from '../types';

export default function InteractionsPage() {
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['interactions', page, channel, status],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (channel) params.channel = channel;
      if (status) params.status = status;
      const { data } = await engagementApi.listInteractions(params);
      return data as PaginatedResponse<Interaction>;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Interactions</h1>
        <button className="btn-primary">Log New Interaction</button>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="input-field">
            <option value="">All Channels</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="in_person_visit">In-Person Visit</option>
            <option value="remote_detailing">Remote Detailing</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field">
            <option value="">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading interactions...</p>
      ) : (
        <div className="space-y-3">
          {data?.data?.map((interaction) => (
            <div key={interaction.id} className="card flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-blue capitalize">{interaction.channel.replace(/_/g, ' ')}</span>
                  <span className={
                    interaction.status === 'completed' ? 'badge-green' :
                    interaction.status === 'planned' ? 'badge-yellow' : 'badge-red'
                  }>
                    {interaction.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  HCP: {interaction.hcpId.substring(0, 8)}... |
                  {interaction.scheduledAt ? ` Scheduled: ${new Date(interaction.scheduledAt).toLocaleDateString()}` : ''}
                  {interaction.durationMinutes ? ` | Duration: ${interaction.durationMinutes}min` : ''}
                </p>
                {interaction.aiSummary && (
                  <p className="text-xs text-gray-400 mt-1 italic">AI: {interaction.aiSummary}</p>
                )}
              </div>
              <button className="btn-secondary text-sm">View</button>
            </div>
          ))}

          {data?.pagination && (
            <div className="flex justify-between items-center pt-4">
              <span className="text-sm text-gray-500">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-secondary text-sm">Previous</button>
                <button onClick={() => setPage(page + 1)} disabled={page >= data.pagination.totalPages} className="btn-secondary text-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
