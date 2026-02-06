import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hcpApi, aiApi, omnichannelApi } from '../services/api';
import type { HCP, AIScore, Consent } from '../types';

export default function HCPDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: hcp, isLoading } = useQuery({
    queryKey: ['hcp', id],
    queryFn: async () => {
      const { data } = await hcpApi.getById(id!);
      return data.data as HCP;
    },
    enabled: !!id,
  });

  const { data: consents } = useQuery({
    queryKey: ['hcp-consents', id],
    queryFn: async () => {
      const { data } = await hcpApi.getConsents(id!);
      return data.data as Consent[];
    },
    enabled: !!id,
  });

  const { data: aiScores } = useQuery({
    queryKey: ['hcp-ai-scores', id],
    queryFn: async () => {
      const { data } = await hcpApi.getAIScores(id!);
      return data.data as AIScore[];
    },
    enabled: !!id,
  });

  const { data: channelRec } = useQuery({
    queryKey: ['channel-recommendation', id],
    queryFn: async () => {
      const { data } = await omnichannelApi.getChannelRecommendation(id!);
      return data.data;
    },
    enabled: !!id,
  });

  if (isLoading) return <p className="text-gray-500">Loading HCP profile...</p>;
  if (!hcp) return <p className="text-red-500">HCP not found</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">
            {hcp.title} {hcp.firstName} {hcp.lastName}
          </h1>
          <p className="text-gray-500 capitalize mt-1">
            {hcp.specialty.replace(/_/g, ' ')} | {hcp.influenceLevel.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary">Log Interaction</button>
          <button className="btn-secondary">Request AI Score</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Profile</h3>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-gray-500">External ID</dt><dd>{hcp.externalId || '-'}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd>{hcp.email || 'Encrypted'}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd>{hcp.phone || 'Encrypted'}</dd></div>
            <div><dt className="text-gray-500">Sub-Specialty</dt><dd>{hcp.subSpecialty || '-'}</dd></div>
            <div><dt className="text-gray-500">Years of Practice</dt><dd>{hcp.yearsOfPractice || '-'}</dd></div>
            <div>
              <dt className="text-gray-500">Therapeutic Areas</dt>
              <dd>{hcp.therapeuticAreas.join(', ') || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Languages</dt>
              <dd>{hcp.languages.join(', ') || '-'}</dd>
            </div>
          </dl>
        </div>

        {/* Consent Status */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Consent Status</h3>
          {consents && consents.length > 0 ? (
            <div className="space-y-2">
              {consents.map((consent) => (
                <div key={consent.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm capitalize">{consent.consentType.replace(/_/g, ' ')}</span>
                  <span className={
                    consent.status === 'granted' ? 'badge-green' :
                    consent.status === 'revoked' ? 'badge-red' :
                    consent.status === 'pending' ? 'badge-yellow' : 'badge'
                  }>
                    {consent.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No consent records</p>
          )}
        </div>

        {/* AI Insights */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">AI Insights</h3>

          {/* Scores */}
          {aiScores && aiScores.length > 0 ? (
            <div className="mb-4">
              {aiScores.slice(0, 2).map((score, i) => (
                <div key={i} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">{score.scoreType.replace(/_/g, ' ')}</span>
                    <span className="font-semibold">{score.score}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-pharma-blue rounded-full h-2 transition-all"
                      style={{ width: `${score.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Confidence: {Math.round(score.confidence * 100)}% | Model: {score.modelVersion}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-4">No AI scores yet</p>
          )}

          {/* Channel Recommendation */}
          {channelRec && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Recommended Channel</p>
              <p className="font-semibold capitalize text-sm">
                {(channelRec as Record<string, string>).recommendedChannel?.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {(channelRec as Record<string, string>).reasoning}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
