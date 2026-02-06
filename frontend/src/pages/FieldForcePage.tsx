import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fieldForceApi } from '../services/api';
import type { VisitPlan } from '../types';

export default function FieldForcePage() {
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: visitPlans, isLoading } = useQuery({
    queryKey: ['visit-plans'],
    queryFn: async () => {
      const { data } = await fieldForceApi.getVisitPlans();
      return data.data as VisitPlan[];
    },
  });

  const { data: suggestions } = useQuery({
    queryKey: ['visit-suggestions', selectedDate],
    queryFn: async () => {
      const { data } = await fieldForceApi.getVisitSuggestions(selectedDate);
      return data.data as Array<Record<string, unknown>>;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Field Force</h1>
        <button className="btn-primary">Create Visit Plan</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visit Plans */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Visit Plans</h2>
          {isLoading ? (
            <p className="text-gray-500">Loading plans...</p>
          ) : visitPlans && visitPlans.length > 0 ? (
            <div className="space-y-3">
              {visitPlans.map((plan) => (
                <div key={plan.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{plan.planDate}</span>
                    <span className={
                      plan.status === 'completed' ? 'badge-green' :
                      plan.status === 'in_progress' ? 'badge-blue' : 'badge-yellow'
                    }>
                      {plan.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{plan.totalVisits} visits planned</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center text-gray-500">
              <p>No visit plans yet. Create one or check AI suggestions.</p>
            </div>
          )}
        </div>

        {/* AI Suggestions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">AI Visit Suggestions</h2>
          <p className="text-sm text-gray-500 mb-4">
            AI-prioritized visit recommendations based on engagement scores and territory coverage.
          </p>
          {suggestions && suggestions.length > 0 ? (
            <div className="space-y-3">
              {suggestions.map((suggestion, i) => (
                <div key={i} className="card p-4 border-l-4 border-pharma-blue">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Visit #{suggestion.sequenceOrder as number}</span>
                    <span className={
                      suggestion.priority === 'high' ? 'badge bg-orange-100 text-orange-800' : 'badge-yellow'
                    }>
                      {suggestion.priority as string}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">HCP: {(suggestion.hcpId as string).substring(0, 12)}...</p>
                  <p className="text-xs text-gray-600 mt-1 italic">{suggestion.reason as string}</p>
                  <button className="text-xs text-pharma-blue mt-2 hover:underline">
                    Add to Visit Plan
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center text-gray-500">
              <p>No suggestions available for this date.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
