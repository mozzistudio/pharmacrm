import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { hcpApi } from '../services/api';
import type { HCP, PaginatedResponse } from '../types';

export default function HCPListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [influenceLevel, setInfluenceLevel] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['hcps', page, search, specialty, influenceLevel],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      if (specialty) params.specialty = specialty;
      if (influenceLevel) params.influenceLevel = influenceLevel;
      const { data } = await hcpApi.list(params);
      return data as PaginatedResponse<HCP>;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">HCP Management</h1>
        <Link to="/hcps/new" className="btn-primary">Add HCP</Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search HCPs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field"
          />
          <select
            value={specialty}
            onChange={(e) => { setSpecialty(e.target.value); setPage(1); }}
            className="input-field"
          >
            <option value="">All Specialties</option>
            <option value="cardiology">Cardiology</option>
            <option value="oncology">Oncology</option>
            <option value="neurology">Neurology</option>
            <option value="endocrinology">Endocrinology</option>
            <option value="general_practice">General Practice</option>
          </select>
          <select
            value={influenceLevel}
            onChange={(e) => { setInfluenceLevel(e.target.value); setPage(1); }}
            className="input-field"
          >
            <option value="">All Influence Levels</option>
            <option value="key_opinion_leader">KOL</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-gray-500">Loading HCPs...</p>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Specialty</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Influence</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.data?.map((hcp) => (
                <tr key={hcp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link to={`/hcps/${hcp.id}`} className="font-medium text-pharma-blue hover:underline">
                      {hcp.title} {hcp.firstName} {hcp.lastName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 capitalize">{hcp.specialty.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4">
                    <span className={
                      hcp.influenceLevel === 'key_opinion_leader' ? 'badge-blue' :
                      hcp.influenceLevel === 'high' ? 'badge-green' :
                      hcp.influenceLevel === 'medium' ? 'badge-yellow' : 'badge'
                    }>
                      {hcp.influenceLevel.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={hcp.isActive ? 'badge-green' : 'badge-red'}>
                      {hcp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/hcps/${hcp.id}`} className="text-pharma-blue hover:underline text-sm">
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {data?.pagination && (
            <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to{' '}
                {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
                {data.pagination.total} HCPs
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= data.pagination.totalPages}
                  className="btn-secondary text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
