'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import Papa from 'papaparse';
import _ from 'lodash';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  return (
    <div style={{
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      padding: '12px',
      borderRadius: '6px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    }}>
      <div style={{ color: '#e2e8f0', marginBottom: '8px', fontWeight: 'bold' }}>
        {data.namespace || data.date}
      </div>
      {Object.entries(data)
        .filter(([key]) => !['namespace', 'date'].includes(key))
        .map(([key, value]: [string, any]) => (
          <div key={key} style={{ color: '#e2e8f0', fontSize: '14px', marginBottom: '4px' }}>
            <span style={{ color: '#94a3b8' }}>
              {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}:
            </span>
            {' '}
            {typeof value === 'number' ? 
              (key.includes('per') ? value.toFixed(2) : value.toLocaleString()) 
              : value}
          </div>
        ))}
    </div>
  );
};

const SEIDashboard = () => {
  const [data, setData] = useState({
    protocolMetrics: [],
    dailyMetrics: [],
    engagementStats: {
      high_concentration: 0,
      healthy_engagement: 0,
      total_protocols: 0
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/daily_stats_by_protocol_sei.csv');
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const text = await response.text();
        const parsed = Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });

        // Calculate protocol-level engagement metrics
        const protocolMetrics = _.chain(parsed.data)
          .groupBy('namespace')
          .map((group, namespace) => {
            const total_txs = _.sumBy(group, 'daily_incoming_txs');
            const total_users = _.sumBy(group, 'daily_active_users');
            const days_active = group.length;
            
            return {
              namespace,
              total_txs,
              total_users,
              avg_daily_users: (total_users / days_active).toFixed(2),
              tx_per_user: (total_txs / total_users).toFixed(2),
              tx_concentration: (total_txs / (total_users * days_active)).toFixed(2)
            };
          })
          .orderBy(['total_txs'], ['desc'])
          .value();

        // Daily metrics with engagement focus
        const dailyMetrics = _.chain(parsed.data)
          .groupBy('date')
          .map((group, date) => {
            const total_txs = _.sumBy(group, 'daily_incoming_txs');
            const total_users = _.sumBy(group, 'daily_active_users');
            const protocols_count = group.length;
            
            return {
              date: new Date(date).toLocaleDateString(),
              total_txs,
              total_users,
              avg_tx_per_user: (total_txs / total_users).toFixed(2),
              protocols_count
            };
          })
          .orderBy('date')
          .value();

        // Engagement statistics
        const engagementStats = {
          high_concentration: _.filter(protocolMetrics, p => parseFloat(p.tx_per_user) > 100).length,
          healthy_engagement: _.filter(protocolMetrics, p => parseFloat(p.tx_per_user) <= 100).length,
          total_protocols: protocolMetrics.length
        };

        setData({
          protocolMetrics,
          dailyMetrics,
          engagementStats
        });
        setError(null);
      } catch (err) {
        console.error('Error processing data:', err);
        setError(err instanceof Error ? err.message : 'Failed to process data');
      } finally {
        setLoading(false);
      }
    };

    processData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-900 min-h-screen text-slate-100">
      <h1 className="text-3xl font-bold mb-8 text-slate-100">SEI Protocol Engagement Analysis</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Protocol Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-100">{data.engagementStats.healthy_engagement} / {data.engagementStats.total_protocols}</p>
            <p className="text-sm text-slate-400">Protocols with healthy engagement (≤100 tx/user)</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">High Concentration Protocols</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-400">{data.engagementStats.high_concentration}</p>
            <p className="text-sm text-slate-400">Protocols with >100 tx/user</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Total Active Protocols</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-100">{data.engagementStats.total_protocols}</p>
            <p className="text-sm text-slate-400">Protocols with recorded activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Scatter Plot */}
      <Card className="mb-8 bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Protocol Engagement Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 70, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  type="number" 
                  dataKey="total_users" 
                  name="Total Users" 
                  label={{ value: 'Total Users', position: 'bottom', fill: '#94a3b8' }}
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="tx_per_user" 
                  name="Tx per User"
                  label={{ value: 'Transactions per User', angle: -90, position: 'left', fill: '#94a3b8' }}
                  tick={{ fill: '#94a3b8' }}
                />
                <ZAxis type="number" dataKey="total_txs" range={[50, 400]} />
                <Tooltip content={<CustomTooltip />} />
                <Scatter
                  data={data.protocolMetrics}
                  fill="#818cf8"
                  fillOpacity={0.8}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card className="mb-8 bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Top Protocols - Transaction Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.protocolMetrics.slice(0, 10)}
                layout="vertical"
                margin={{ top: 20, right: 20, bottom: 20, left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94a3b8' }} />
                <YAxis 
                  type="category" 
                  dataKey="namespace" 
                  width={100} 
                  tick={{ fill: '#94a3b8' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="total_txs" 
                  fill="#818cf8"
                  radius={[4, 4, 4, 4]}
                  fillOpacity={0.8}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Line Chart */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Daily User Engagement Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={data.dailyMetrics}
                margin={{ top: 20, right: 20, bottom: 70, left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="date" 
                  angle={-45} 
                  textAnchor="end" 
                  height={60}
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8' }} />
                <Line 
                  type="monotone" 
                  dataKey="avg_tx_per_user" 
                  name="Avg Tx per User" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="protocols_count" 
                  name="Active Protocols" 
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SEIDashboard;
