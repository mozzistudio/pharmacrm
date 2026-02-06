import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, aiApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import type { DashboardData, NextBestAction } from '../types';

export default function DashboardPage() {
  const [period, setPeriod] = useState('30d');
  const user = useAuthStore((s) => s.user);

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: async () => {
      const { data } = await analyticsApi.getDashboard(period);
      return data.data as DashboardData;
    },
  });

  const { data: pendingNBAs } = useQuery({
    queryKey: ['pending-nbas'],
    queryFn: async () => {
      const { data } = await aiApi.getPendingNBAs();
      return data.data as NextBestAction[];
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName}
          </h1>
          <p className="text-gray-500 mt-1">Here's your CRM overview</p>
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input-field w-auto"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="text-gray-500">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {dashboardData?.kpis?.map((kpi) => (
              <div key={kpi.name} className="card">
                <p className="text-sm text-gray-500">{kpi.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {kpi.value}
                  {kpi.unit === 'percent' && '%'}
                </p>
              </div>
            ))}
          </div>

          {/* Channel Breakdown */}
          {dashboardData?.channelBreakdown && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Channel Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(dashboardData.channelBreakdown).map(([channel, count]) => (
                    <div key={channel} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 capitalize">
                        {channel.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-pharma-blue rounded-full h-2"
                            style={{
                              width: `${Math.min(
                                (count / Math.max(...Object.values(dashboardData.channelBreakdown))) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Recommendations */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">AI Recommendations</h3>
                {pendingNBAs && pendingNBAs.length > 0 ? (
                  <div className="space-y-3">
                    {pendingNBAs.slice(0, 5).map((nba) => (
                      <div key={nba.id} className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="badge-blue capitalize">
                            {nba.recommendedChannel.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            Confidence: {Math.round(nba.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{nba.suggestedContent}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No pending recommendations</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
