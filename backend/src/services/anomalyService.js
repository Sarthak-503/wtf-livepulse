import pool from "../db/pool.js";

export class AnomalyDetectionService {
  /**
   * Detect zero check-ins: gym has 0 members and last check-in > 2 hours ago
   */
  async detectZeroCheckins() {
    const query = `
      SELECT g.id, g.name
      FROM gyms g
      WHERE g.status = 'active'
        AND EXTRACT(HOUR FROM CURRENT_TIME)::INT >= EXTRACT(HOUR FROM g.opens_at)::INT
        AND EXTRACT(HOUR FROM CURRENT_TIME)::INT < EXTRACT(HOUR FROM g.closes_at)::INT
        AND NOT EXISTS (
          SELECT 1 FROM checkins c
          WHERE c.gym_id = g.id
            AND c.checked_out IS NULL
        )
        AND (
          SELECT COALESCE(MAX(checked_in), NOW() - INTERVAL '3 hours')
          FROM checkins c
          WHERE c.gym_id = g.id
        ) < NOW() - INTERVAL '2 hours'
    `;

    const result = await pool.query(query);
    const detectedGyms = result.rows.map((row) => row.id);

    // Remove old zero_checkins anomalies for gyms that recovered
    await pool.query(
      `
      DELETE FROM anomalies
      WHERE type = 'zero_checkins'
        AND resolved = FALSE
        AND gym_id NOT IN (${detectedGyms.map(() => "?").join(",") || "NULL"})
    `,
      detectedGyms,
    );

    // Create new anomalies
    for (const gym of result.rows) {
      await this.insertAnomalyIfNew(
        gym.id,
        "zero_checkins",
        "warning",
        `No check-ins at ${gym.name} for 2+ hours`,
      );
    }
  }

  /**
   * Detect capacity breach: occupancy > 90% of capacity
   */
  async detectCapacityBreach() {
    const query = `
      SELECT
        g.id,
        g.name,
        g.capacity,
        COUNT(c.id) as current_occupancy,
        ROUND(100.0 * COUNT(c.id) / g.capacity, 2) as occupancy_pct
      FROM gyms g
      LEFT JOIN checkins c ON c.gym_id = g.id AND c.checked_out IS NULL
      WHERE g.status = 'active'
      GROUP BY g.id, g.name, g.capacity
      HAVING COUNT(c.id)::FLOAT / g.capacity > 0.90
    `;

    const result = await pool.query(query);

    // Create new anomalies for breached gyms
    for (const gym of result.rows) {
      await this.insertAnomalyIfNew(
        gym.id,
        "capacity_breach",
        "critical",
        `${gym.name} at ${gym.occupancy_pct}% capacity (${gym.current_occupancy}/${gym.capacity})`,
      );
    }

    // Auto-resolve capacity breach anomalies for gyms that recovered
    const allGyms = await pool.query("SELECT id FROM gyms WHERE status = $1", [
      "active",
    ]);
    const breachedIds = result.rows.map((r) => r.id);
    const recoveredIds = allGyms.rows
      .filter((g) => !breachedIds.includes(g.id))
      .map((g) => g.id);

    if (recoveredIds.length > 0) {
      await pool.query(
        `
        UPDATE anomalies
        SET resolved = TRUE, resolved_at = NOW()
        WHERE type = 'capacity_breach'
          AND resolved = FALSE
          AND gym_id = ANY($1)
      `,
        [recoveredIds],
      );
    }
  }

  /**
   * Detect revenue drop: today's revenue < 70% of same day last week
   */
  async detectRevenueDrops() {
    const query = `
      WITH today_revenue AS (
        SELECT
          gym_id,
          COALESCE(SUM(amount), 0) as today_total
        FROM payments
        WHERE DATE(paid_at) = CURRENT_DATE
        GROUP BY gym_id
      ),
      last_week_revenue AS (
        SELECT
          gym_id,
          COALESCE(SUM(amount), 0) as last_week_total
        FROM payments
        WHERE DATE(paid_at) = CURRENT_DATE - INTERVAL '7 days'
        GROUP BY gym_id
      )
      SELECT
        g.id,
        g.name,
        COALESCE(tr.today_total, 0) as today_amount,
        COALESCE(lr.last_week_total, 0) as last_week_amount,
        ROUND(100.0 * COALESCE(tr.today_total, 0) / NULLIF(COALESCE(lr.last_week_total, 1), 0), 2) as pct_of_last_week
      FROM gyms g
      LEFT JOIN today_revenue tr ON tr.gym_id = g.id
      LEFT JOIN last_week_revenue lr ON lr.gym_id = g.id
      WHERE g.status = 'active'
        AND COALESCE(lr.last_week_total, 0) > 0
        AND COALESCE(tr.today_total, 0) < (COALESCE(lr.last_week_total, 0) * 0.70)
    `;

    const result = await pool.query(query);

    for (const gym of result.rows) {
      await this.insertAnomalyIfNew(
        gym.id,
        "revenue_drop",
        "warning",
        `${gym.name}: Today ₹${gym.today_amount} vs Last Week ₹${gym.last_week_amount} (${gym.pct_of_last_week}%)`,
      );
    }

    // Auto-resolve revenue drops for gyms that recovered
    const affectedIds = result.rows.map((r) => r.id);
    const allGyms = await pool.query("SELECT id FROM gyms WHERE status = $1", [
      "active",
    ]);
    const recoveredIds = allGyms.rows
      .filter((g) => !affectedIds.includes(g.id))
      .map((g) => g.id);

    if (recoveredIds.length > 0) {
      await pool.query(
        `
        UPDATE anomalies
        SET resolved = TRUE, resolved_at = NOW()
        WHERE type = 'revenue_drop'
          AND resolved = FALSE
          AND gym_id = ANY($1)
      `,
        [recoveredIds],
      );
    }
  }

  /**
   * Insert anomaly if it doesn't already exist (prevent duplicates)
   */
  async insertAnomalyIfNew(gymId, type, severity, message) {
    const existingQuery = `
      SELECT id FROM anomalies
      WHERE gym_id = $1 AND type = $2 AND resolved = FALSE
      LIMIT 1
    `;

    const existing = await pool.query(existingQuery, [gymId, type]);

    if (existing.rows.length === 0) {
      const insertQuery = `
        INSERT INTO anomalies (gym_id, type, severity, message)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      return await pool.query(insertQuery, [gymId, type, severity, message]);
    }
  }

  /**
   * Run full anomaly detection cycle
   */
  async runDetectionCycle() {
    try {
      await this.detectZeroCheckins();
      await this.detectCapacityBreach();
      await this.detectRevenueDrops();
      console.log("[Anomaly Detector] Detection cycle completed");
    } catch (error) {
      console.error("[Anomaly Detector] Error during detection cycle:", error);
    }
  }
}

export default new AnomalyDetectionService();
