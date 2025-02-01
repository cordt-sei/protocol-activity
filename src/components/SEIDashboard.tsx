'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import Papa from 'papaparse';
import _ from 'lodash';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold mb-4">SEI Protocol Engagement Analysis</h1>
      
      {/* Engagement Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Protocol Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.engagementStats.healthy_engagement} / {data.engagementStats.total_protocols}</p>
            <p className="text-sm text-gray-500">Protocols with healthy engagement (≤100 tx/user)</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50">
          <CardHeader>
            <CardTitle>High Concentration Protocols</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.engagementStats.high_concentration}</p>
            <p className="text-sm text-gray-500">Protocols with >100 tx/user</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Active Protocols</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.engagementStats.total_protocols}</p>
            <p className="text-sm text-gray-500">Protocols with recorded activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Protocol Engagement Scatter Plot */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Protocol Engagement Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="total_users" name="Total Users" 
                       label={{ value: 'Total Users', position: 'bottom' }} />
                <YAxis type="number" dataKey="tx_per_user" name="Tx per User"
                       label={{ value: 'Transactions per User', angle: -90, position: 'left' }} />
                <ZAxis type="number" dataKey="total_txs" range={[50, 400]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} 
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-2 border">
                          <p className="font-bold">{data.namespace}</p>
                          <p>Users: {Number(data.total_users).toLocaleString()}</p>
                          <p>Tx/User: {Number(data.tx_per_user).toFixed(2)}</p>
                          <p>Total Tx: {Number(data.total_txs).toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter
                  data={data.protocolMetrics}
                  fill="#8884d8"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-gray-500 mt-2">Bubble size represents total transaction volume</p>
        </CardContent>
      </Card>

      {/* Top 10 Protocols by Transaction Volume with Engagement Metrics */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Top Protocols - Transaction Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.protocolMetrics.slice(0, 10)}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="namespace" width={100} />
                <Tooltip
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-2 border">
                          <p className="font-bold">{data.namespace}</p>
                          <p>Total Tx: {Number(data.total_txs).toLocaleString()}</p>
                          <p>Total Users: {Number(data.total_users).toLocaleString()}</p>
                          <p>Tx/User: {Number(data.tx_per_user).toFixed(2)}</p>
                          <p>Avg Daily Users: {Number(data.avg_daily_users).toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="total_txs" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Daily Engagement Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Daily User Engagement Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg_tx_per_user" name="Avg Tx per User" stroke="#ff7300" />
                <Line type="monotone" dataKey="protocols_count" name="Active Protocols" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SEIDashboard;
