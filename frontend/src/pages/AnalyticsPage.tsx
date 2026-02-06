import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');

  const { data: territoryData } = useQuery({
    queryKey: ['territory-performance', period],
    queryFn: async () => {
      const { data } = await analyticsApi.getTerritoryPerformance(period);
      return data.data as Array<Record<string, unknown>>;
    },
  });

  const { data: trends } = useQuery({
    queryKey: ['engagement-trends', period],
    queryFn: async () => {
      const { data } = await analyticsApi.getEngagementTrends(period);
      return data.data as Array<Record<string, unknown>>;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics & Forecasting</h1>
        <div className="flex gap-3">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input-field w-auto">
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="1y">1 Year</option>
          </select>
          <button className="btn-primary">Export Report</button>
        </div>
      </div>

      {/* Territory Performance */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4">Territory Performance</h3>
        {territoryData && territoryData.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Territory</th>
                <th className="px-4 py-2 text-left">Region</th>
                <th className="px-4 py-2 text-right">HCPs</th>
                <th className="px-4 py-2 text-right">Active</th>
                <th className="px-4 py-2 text-right">Interactions</th>
                <th className="px-4 py-2 text-right">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {territoryData.map((territory) => (
                <tr key={territory.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{territory.name as string}</td>
                  <td className="px-4 py-2 text-gray-500">{territory.region as string}</td>
                  <td className="px-4 py-2 text-right">{territory.total_hcps as number}</td>
                  <td className="px-4 py-2 text-right">{territory.active_hcps as number}</td>
                  <td className="px-4 py-2 text-right">{territory.total_interactions as number}</td>
                  <td className="px-4 py-2 text-right">{territory.completed_interactions as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">No territory data available</p>
        )}
      </div>

      {/* Engagement Trends */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Engagement Trends</h3>
        {trends && trends.length > 0 ? (
          <div className="space-y-2">
            {trends.slice(-14).map((trend) => (
              <div key={trend.date as string} className="flex items-center gap-4 text-sm">
                <span className="w-24 text-gray-500">{trend.date as string}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-pharma-blue rounded-full h-2"
                    style={{
                      width: `${Math.min(((trend.total as number) / Math.max(...trends.map((t) => t.total as number))) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="w-16 text-right font-medium">{trend.total as number}</span>
                <span className="w-20 text-right text-gray-500">{trend.unique_hcps as number} HCPs</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No trend data available</p>
        )}
      </div>
    </div>
  );
}
