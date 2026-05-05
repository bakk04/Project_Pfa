'use client';

import React, { useEffect, useState } from 'react';

const SystemOverviewPage = () => {
  const [system, setSystem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        const response = await fetch('/api/dashboardAdmin/stats');
        if (response.ok) {
          const data = await response.json();
          setSystem(data.system);
        }
      } catch (error) {
        console.error('Error fetching system data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemData();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap page-breadcrumb gap-3 mb-6">
        <div className="my-auto">
          <h3 className="text-xl font-bold">System Overview</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* CPU Usage */}
        <div className="bg-white rounded-lg border border-border-color p-5">
          <h6 className="text-gray-600 text-sm mb-4">CPU Usage</h6>
          <div className="flex items-end gap-2 mb-2">
            <h3 className="font-bold text-2xl">{loading ? '...' : `${system?.cpu}%`}</h3>
            <span className={`text-xs mb-1 flex items-center ${system?.cpu > 80 ? 'text-danger' : 'text-success'}`}>
              <i className={`ph ${system?.cpu > 80 ? 'ph-trend-up' : 'ph-trend-down'} me-1`}></i>
              {system?.cpu > 80 ? 'High Load' : 'Stable'}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all duration-1000 ${system?.cpu > 80 ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${system?.cpu}%` }}></div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-white rounded-lg border border-border-color p-5">
          <h6 className="text-gray-600 text-sm mb-4">Memory Usage</h6>
          <div className="flex items-end gap-2 mb-2">
            <h3 className="font-bold text-2xl">{loading ? '...' : system?.usedMemory}</h3>
            <span className="text-gray-400 text-xs mb-1">of {system?.totalMemory}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${system?.memory}%` }}></div>
          </div>
        </div>

        {/* Storage */}
        <div className="bg-white rounded-lg border border-border-color p-5">
          <h6 className="text-gray-600 text-sm mb-4">Storage</h6>
          <div className="flex items-end gap-2 mb-2">
            <h3 className="font-bold text-2xl">1.2 TB</h3>
            <span className="text-gray-400 text-xs mb-1">Used</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-orange-500 h-2 rounded-full" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border-color overflow-hidden">
        <div className="p-4 border-b border-border-color flex items-center justify-between">
          <h6 className="font-semibold">Recent System Logs</h6>
          <span className="size-2.5 bg-success rounded-full animate-pulse"></span>
        </div>
        <div className="p-4">
          <ul className="space-y-4">
            <li className="flex gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="size-8 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
                <i className="ph ph-check-circle text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-semibold">Database backup completed</p>
                <p className="text-xs text-gray-500">Scheduled backup successfully stored in AWS S3</p>
                <p className="text-[10px] text-gray-400 mt-1">2 minutes ago</p>
              </div>
            </li>
            <li className="flex gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <i className="ph ph-info text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-semibold">System update v2.4.1 deployed</p>
                <p className="text-xs text-gray-500">Security patches and performance improvements applied</p>
                <p className="text-[10px] text-gray-400 mt-1">1 hour ago</p>
              </div>
            </li>
            <li className="flex gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="size-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
                <i className="ph ph-warning text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-semibold">High traffic detected</p>
                <p className="text-xs text-gray-500">API node #3 auto-scaled to handle increased load</p>
                <p className="text-[10px] text-gray-400 mt-1">3 hours ago</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default SystemOverviewPage;
