import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { complianceApi } from '../services/api';

export default function CompliancePage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const { data: dashboard } = useQuery({
    queryKey: ['compliance-dashboard'],
    queryFn: async () => {
      const { data } = await complianceApi.getDashboard();
      return data.data as Record<string, Record<string, number>>;
    },
  });

  const { data: auditLog, isLoading } = useQuery({
    queryKey: ['audit-log', page, actionFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 25 };
      if (actionFilter) params.action = actionFilter;
      const { data } = await complianceApi.getAuditLog(params);
      return data;
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Compliance & Governance</h1>

      {/* Compliance KPIs */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-500">Consents Granted</p>
            <p className="text-2xl font-bold text-green-600">{dashboard.consents?.granted || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Consents Revoked</p>
            <p className="text-2xl font-bold text-red-600">{dashboard.consents?.revoked || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Audit Events (24h)</p>
            <p className="text-2xl font-bold">{dashboard.auditActivity?.last24Hours || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">AI Decisions (30d)</p>
            <p className="text-2xl font-bold text-pharma-blue">{dashboard.aiDecisions?.last30Days || 0}</p>
          </div>
        </div>
      )}

      {/* Audit Log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Audit Log</h3>
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="view">View</option>
            <option value="export">Export</option>
            <option value="login">Login</option>
            <option value="consent_change">Consent Change</option>
            <option value="ai_decision">AI Decision</option>
          </select>
        </div>

        {isLoading ? (
          <p className="text-gray-500">Loading audit log...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Timestamp</th>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-left">Entity</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(auditLog as Record<string, unknown>)?.data &&
                  ((auditLog as Record<string, unknown>).data as Array<Record<string, unknown>>).map(
                    (entry: Record<string, unknown>) => (
                      <tr key={entry.id as string} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500">
                          {new Date(entry.created_at as string).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <span className="badge-blue">{entry.action as string}</span>
                        </td>
                        <td className="px-4 py-2">{entry.entity_type as string}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {(entry.user_id as string)?.substring(0, 8) || 'system'}...
                        </td>
                        <td className="px-4 py-2 text-gray-400">{entry.ip_address as string}</td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
