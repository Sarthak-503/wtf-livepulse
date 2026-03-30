import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import pool from './db/pool.js';
import anomalyService from './services/anomalyService.js';
import { SimulatorService } from './services/simulatorService.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

let simulator = null;
let anomalyDetectionInterval = null;

// WebSocket broadcasting
const broadcastToClients = (event) => {
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(event));
    }
  });
};

simulator = new SimulatorService(broadcastToClients);

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');
  
  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
  });
});

// ============================================
// REST API ENDPOINTS
// ============================================

// GET /api/gyms - List all gyms with occupancy and revenue
app.get('/api/gyms', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        g.id,
        g.name,
        g.city,
        g.capacity,
        g.status,
        COUNT(c.id) FILTER (WHERE c.checked_out IS NULL) as current_occupancy,
        COALESCE(SUM(p.amount), 0) as today_revenue
      FROM gyms g
      LEFT JOIN checkins c ON c.gym_id = g.id AND c.checked_out IS NULL
      LEFT JOIN payments p ON p.gym_id = g.id AND DATE(p.paid_at) = CURRENT_DATE
      GROUP BY g.id
      ORDER BY g.name
    `);

    res.json(result.rows.map(row => ({
      ...row,
      current_occupancy: parseInt(row.current_occupancy) || 0,
      today_revenue: parseFloat(row.today_revenue),
    })));
  } catch (error) {
    console.error('Error fetching gyms:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gyms/:id/live - Live snapshot for single gym
app.get('/api/gyms/:id/live', async (req, res) => {
  try {
    const { id } = req.params;

    const gymResult = await pool.query(`
      SELECT g.*, 
        COUNT(c.id) FILTER (WHERE c.checked_out IS NULL) as current_occupancy,
        COALESCE(SUM(p.amount), 0) as today_revenue
      FROM gyms g
      LEFT JOIN checkins c ON c.gym_id = g.id AND c.checked_out IS NULL
      LEFT JOIN payments p ON p.gym_id = g.id AND DATE(p.paid_at) = CURRENT_DATE
      WHERE g.id = $1
      GROUP BY g.id
    `, [id]);

    if (gymResult.rows.length === 0) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const gym = gymResult.rows[0];

    // Get recent events
    const eventsResult = await pool.query(`
      SELECT
        'checkin' as event_type,
        m.name as member_name,
        g.name as gym_name,
        c.checked_in as timestamp
      FROM checkins c
      JOIN members m ON m.id = c.member_id
      JOIN gyms g ON g.id = c.gym_id
      WHERE c.gym_id = $1
      ORDER BY c.checked_in DESC
      LIMIT 10
    `, [id]);

    // Get active anomalies
    const anomaliesResult = await pool.query(`
      SELECT * FROM anomalies
      WHERE gym_id = $1 AND resolved = FALSE
      ORDER BY detected_at DESC
    `, [id]);

    res.json({
      gym: {
        ...gym,
        current_occupancy: parseInt(gym.current_occupancy) || 0,
        today_revenue: parseFloat(gym.today_revenue),
      },
      recent_events: eventsResult.rows,
      active_anomalies: anomaliesResult.rows,
    });
  } catch (error) {
    console.error('Error fetching gym snapshot:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gyms/:id/analytics - Analytics for single gym
app.get('/api/gyms/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;

    // Peak hours heatmap
    const heatmapResult = await pool.query(`
      SELECT day_of_week, hour_of_day, checkin_count
      FROM gym_hourly_stats
      WHERE gym_id = $1
      ORDER BY day_of_week, hour_of_day
    `, [id]);

    // Revenue by plan type (last 30 days)
    const revenueResult = await pool.query(`
      SELECT
        plan_type,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE gym_id = $1 AND paid_at >= NOW() - INTERVAL '30 days'
      GROUP BY plan_type
    `, [id]);

    // Churn risk members
    const churnResult = await pool.query(`
      SELECT
        id,
        name,
        last_checkin_at,
        CASE
          WHEN last_checkin_at < NOW() - INTERVAL '60 days' THEN 'CRITICAL'
          WHEN last_checkin_at < NOW() - INTERVAL '45 days' THEN 'HIGH'
          ELSE 'HEALTHY'
        END as risk_level
      FROM members
      WHERE gym_id = $1
        AND status = 'active'
        AND last_checkin_at < NOW() - INTERVAL '45 days'
      ORDER BY last_checkin_at
    `, [id]);

    // New vs renewal ratio
    const memberRatioResult = await pool.query(`
      SELECT
        member_type,
        COUNT(*) as count
      FROM payments
      WHERE gym_id = $1 AND paid_at >= NOW() - INTERVAL '30 days'
      GROUP BY member_type
    `, [id]);

    res.json({
      heatmap: heatmapResult.rows,
      revenue_breakdown: revenueResult.rows,
      churn_risk: churnResult.rows,
      member_ratio: memberRatioResult.rows,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/anomalies - List all active anomalies
app.get('/api/anomalies', async (req, res) => {
  try {
    const { gym_id, severity } = req.query;

    let query = `
      SELECT a.*, g.name as gym_name
      FROM anomalies a
      JOIN gyms g ON g.id = a.gym_id
      WHERE a.resolved = FALSE
    `;

    const params = [];

    if (gym_id) {
      query += ` AND a.gym_id = $${params.length + 1}`;
      params.push(gym_id);
    }

    if (severity) {
      query += ` AND a.severity = $${params.length + 1}`;
      params.push(severity);
    }

    query += ` ORDER BY a.detected_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/anomalies/:id/dismiss - Dismiss warning anomaly
app.patch('/api/anomalies/:id/dismiss', async (req, res) => {
  try {
    const { id } = req.params;

    const anomalyResult = await pool.query(`
      SELECT * FROM anomalies WHERE id = $1
    `, [id]);

    if (anomalyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Anomaly not found' });
    }

    const anomaly = anomalyResult.rows[0];

    if (anomaly.severity === 'critical') {
      return res.status(403).json({ error: 'Cannot dismiss critical anomalies' });
    }

    const result = await pool.query(`
      UPDATE anomalies
      SET dismissed = TRUE
      WHERE id = $1
      RETURNING *
    `, [id]);

    broadcastToClients({
      type: 'ANOMALY_DISMISSED',
      anomaly_id: id,
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error dismissing anomaly:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analytics/cross-gym - Cross-gym revenue comparison
app.get('/api/analytics/cross-gym', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        g.id,
        g.name,
        g.city,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        COUNT(p.id) as payment_count,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(p.amount), 0) DESC) as rank
      FROM gyms g
      LEFT JOIN payments p ON p.gym_id = g.id AND p.paid_at >= NOW() - INTERVAL '30 days'
      GROUP BY g.id, g.name, g.city
      ORDER BY total_revenue DESC
    `);

    res.json(result.rows.map(row => ({
      ...row,
      total_revenue: parseFloat(row.total_revenue),
    })));
  } catch (error) {
    console.error('Error fetching cross-gym analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/simulator/start - Start simulator
app.post('/api/simulator/start', (req, res) => {
  const { speed } = req.body;
  const speedMultiplier = speed || 1;

  simulator.start(speedMultiplier);
  
  broadcastToClients({
    type: 'SIMULATOR_STATUS',
    status: 'running',
    speed: speedMultiplier,
  });

  res.json({ status: 'running', speed: speedMultiplier });
});

// POST /api/simulator/stop - Pause simulator
app.post('/api/simulator/stop', (req, res) => {
  simulator.stop();

  broadcastToClients({
    type: 'SIMULATOR_STATUS',
    status: 'paused',
  });

  res.json({ status: 'paused' });
});

// POST /api/simulator/reset - Reset simulator
app.post('/api/simulator/reset', async (req, res) => {
  simulator.stop();
  await simulator.reset();

  broadcastToClients({
    type: 'SIMULATOR_STATUS',
    status: 'reset',
  });

  res.json({ status: 'reset' });
});

// ============================================
// BACKGROUND JOBS
// ============================================

const startAnomalyDetection = () => {
  // Run immediately
  anomalyService.runDetectionCycle();

  // Then every 30 seconds
  anomalyDetectionInterval = setInterval(() => {
    anomalyService.runDetectionCycle();
  }, 30000);

  console.log('[Anomaly Detector] Started');
};

const stopAnomalyDetection = () => {
  if (anomalyDetectionInterval) {
    clearInterval(anomalyDetectionInterval);
  }
};

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`WTF LivePulse Backend listening on port ${PORT}`);
  startAnomalyDetection();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  stopAnomalyDetection();
  simulator.stop();
  server.close();
});

export default app;