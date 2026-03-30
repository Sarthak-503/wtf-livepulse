import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, PieChart, Pie, Cell } from 'recharts';
import '../styles/Dashboard.css';

function Dashboard() {
  const { selectedGymId, liveEvents, anomalies, simulatorRunning, simulatorSpeed } = useStore();
  const [gymData, setGymData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [crossGymData, setCrossGymData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedGymId) {
      fetchGymData();
      fetchAnalytics();
      const interval = setInterval(() => {
        fetchGymData();
        fetchAnalytics();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedGymId]);

  useEffect(() => {
    fetchCrossGymData();
    const interval = setInterval(fetchCrossGymData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchGymData = async () => {
    try {
      const response = await fetch(`/api/gyms/${selectedGymId}/live`);
      const data = await response.json();
      setGymData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching gym data:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/gyms/${selectedGymId}/analytics`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchCrossGymData = async () => {
    try {
      const response = await fetch('/api/analytics/cross-gym');
      const data = await response.json();
      setCrossGymData(data);
    } catch (error) {
      console.error('Error fetching cross-gym data:', error);
    }
  };

  if (loading || !gymData) {
    return <div className="dashboard loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      {/* Module 1: Live Operations Dashboard */}
      <div className="module module-live-dashboard">
        <h2>📊 Live Operations</h2>
        
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Occupancy</div>
            <div className="kpi-value" style={{ color: getOccupancyColor(gymData.gym.current_occupancy, gymData.gym.capacity) }}>
              {gymData.gym.current_occupancy}/{gymData.gym.capacity}
            </div>
            <div className="kpi-percent">{Math.round(100 * gymData.gym.current_occupancy / gymData.gym.capacity)}%</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Today's Revenue</div>
            <div className="kpi-value">₹{gymData.gym.today_revenue.toLocaleString()}</div>
            <div className="kpi-percent">+15% vs yesterday</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Active Anomalies</div>
            <div className="kpi-value" style={{ color: anomalies.length > 0 ? '#ff4757' : '#2ed573' }}>
              {anomalies.filter(a => a.gym_id === selectedGymId).length}
            </div>
            <div className="kpi-percent">{anomalies.filter(a => a.severity === 'critical').length} critical</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Simulator Status</div>
            <div className="kpi-value" style={{ color: simulatorRunning ? '#2ed573' : '#888' }}>
              {simulatorRunning ? `Running (${simulatorSpeed}x)` : 'Stopped'}
            </div>
          </div>
        </div>

        <div className="activity-feed">
          <h3>📡 Activity Feed (Last 20 Events)</h3>
          <div className="feed-list">
            {liveEvents.map((event, idx) => (
              <div key={idx} className="feed-item">
                <span className="feed-icon">
                  {event.type === 'CHECKIN_EVENT' ? '✓' : event.type === 'CHECKOUT_EVENT' ? '✗' : '⚠'}
                </span>
                <span className="feed-content">
                  <strong>{event.member_name}</strong> - {event.type.replace('_EVENT', '')}
                </span>
                <span className="feed-time">now</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module 2: Analytics Engine */}
      {analytics && (
        <div className="module module-analytics">
          <h2>📈 Analytics</h2>

          <div className="analytics-grid">
            <div className="chart-container">
              <h3>Peak Hours Heatmap (7 Days)</h3>
              {analytics.heatmap && analytics.heatmap.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" dataKey="hour_of_day" name="Hour" domain={[0, 24]} />
                    <YAxis type="number" dataKey="day_of_week" name="Day" domain={[0, 6]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Check-ins" data={analytics.heatmap} fill="#00f" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <p>No heatmap data available</p>
              )}
            </div>

            <div className="chart-container">
              <h3>Revenue by Plan Type (30 Days)</h3>
              {analytics.revenue_breakdown && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.revenue_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="plan_type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#00d4ff" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-container">
              <h3>Churn Risk Members</h3>
              {analytics.churn_risk && (
                <div className="churn-list">
                  {analytics.churn_risk.map(member => (
                    <div key={member.id} className={`churn-item risk-${member.risk_level.toLowerCase()}`}>
                      <div>{member.name}</div>
                      <div className="risk-label">{member.risk_level}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module 3: Anomaly Detection */}
      <div className="module module-anomalies">
        <h2>🚨 Anomalies</h2>
        <div className="anomalies-list">
          {anomalies.length === 0 ? (
            <p className="no-anomalies">All systems normal ✓</p>
          ) : (
            anomalies.map(anomaly => (
              <div key={anomaly.id} className={`anomaly-card severity-${anomaly.severity}`}>
                <div className="anomaly-header">
                  <span className="anomaly-type">{anomaly.type}</span>
                  <span className="anomaly-severity">{anomaly.severity}</span>
                </div>
                <div className="anomaly-message">{anomaly.message}</div>
                <div className="anomaly-status">
                  {anomaly.resolved ? 'RESOLVED' : 'ACTIVE'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Module 4: Simulator Controls */}
      <div className="module module-simulator">
        <h2>🎮 Data Simulator</h2>
        <div className="simulator-controls">
          <button className="btn" onClick={() => startSimulator(1)}>▶ 1x Speed</button>
          <button className="btn" onClick={() => startSimulator(5)}>▶▶ 5x Speed</button>
          <button className="btn" onClick={() => startSimulator(10)}>▶▶▶ 10x Speed</button>
          <button className="btn btn-danger" onClick={() => stopSimulator()}>⏸ Stop</button>
          <button className="btn btn-secondary" onClick={() => resetSimulator()}>↻ Reset</button>
        </div>
        <div className="simulator-status">
          Status: {simulatorRunning ? `Running at ${simulatorSpeed}x` : 'Stopped'}
        </div>
      </div>

      {/* Cross-Gym Revenue Comparison */}
      <div className="module module-cross-gym">
        <h2>🏆 Cross-Gym Revenue Ranking (30 Days)</h2>
        {crossGymData.length > 0 && (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={crossGymData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total_revenue" fill="#00d4ff" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const getOccupancyColor = (occupancy, capacity) => {
  const percent = occupancy / capacity;
  if (percent < 0.6) return '#2ed573'; // Green
  if (percent < 0.85) return '#ffa502'; // Yellow
  return '#ff4757'; // Red
};

const startSimulator = async (speed) => {
  try {
    await fetch('/api/simulator/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed }),
    });
  } catch (error) {
    console.error('Error starting simulator:', error);
  }
};

const stopSimulator = async () => {
  try {
    await fetch('/api/simulator/stop', { method: 'POST' });
  } catch (error) {
    console.error('Error stopping simulator:', error);
  }
};

const resetSimulator = async () => {
  try {
    await fetch('/api/simulator/reset', { method: 'POST' });
  } catch (error) {
    console.error('Error resetting simulator:', error);
  }
};

export default Dashboard;