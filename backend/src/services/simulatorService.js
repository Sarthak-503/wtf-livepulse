import pool from "../db/pool.js";

export class SimulatorService {
  constructor(broadcastFn) {
    this.running = false;
    this.speed = 1;
    this.broadcastFn = broadcastFn;
    this.interval = null;
  }

  start(speedMultiplier = 1) {
    this.running = true;
    this.speed = speedMultiplier;

    // Generate check-ins every 2 seconds / multiplier
    const interval = Math.max(500, 2000 / speedMultiplier);

    this.interval = setInterval(() => this.generateEvent(), interval);
    console.log(`[Simulator] Started at ${speedMultiplier}x speed`);
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    console.log("[Simulator] Stopped");
  }

  async reset() {
    await pool.query(`
      DELETE FROM checkins
      WHERE checked_in >= CURRENT_DATE
        AND checked_out IS NULL
    `);
    console.log("[Simulator] Reset to baseline");
  }

  async generateEvent() {
    try {
      const eventType = Math.random() > 0.3 ? "checkin" : "checkout";

      if (eventType === "checkin") {
        await this.simulateCheckin();
      } else {
        await this.simulateCheckout();
      }
    } catch (error) {
      console.error("[Simulator] Error generating event:", error);
    }
  }

  async simulateCheckin() {
    // Pick a random active gym
    const gymResult = await pool.query(`
      SELECT id, name, capacity
      FROM gyms
      WHERE status = 'active'
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (gymResult.rows.length === 0) return;

    const gym = gymResult.rows[0];

    // Pick a random member from that gym
    const memberResult = await pool.query(
      `
      SELECT id, name
      FROM members
      WHERE gym_id = $1 AND status = 'active'
      ORDER BY RANDOM()
      LIMIT 1
    `,
      [gym.id],
    );

    if (memberResult.rows.length === 0) return;

    const member = memberResult.rows[0];

    // Insert check-in
    const checkinResult = await pool.query(
      `
      INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
      VALUES ($1, $2, NOW(), NULL)
      RETURNING id
    `,
      [member.id, gym.id],
    );

    // Get current occupancy
    const occupancyResult = await pool.query(
      `
      SELECT COUNT(*) as count, capacity FROM checkins
      JOIN gyms ON gyms.id = checkins.gym_id
      WHERE gym_id = $1 AND checked_out IS NULL
      GROUP BY capacity
    `,
      [gym.id],
    );

    const occupancy = occupancyResult.rows[0];
    const occupancyPct = occupancy
      ? Math.round((100 * occupancy.count) / occupancy.capacity)
      : 0;

    // Broadcast event
    this.broadcastFn({
      type: "CHECKIN_EVENT",
      gym_id: gym.id,
      gym_name: gym.name,
      member_name: member.name,
      timestamp: new Date().toISOString(),
      current_occupancy: occupancy?.count || 0,
      capacity_pct: occupancyPct,
    });

    // Update member's last_checkin_at
    await pool.query(
      `
      UPDATE members
      SET last_checkin_at = NOW()
      WHERE id = $1
    `,
      [member.id],
    );
  }

  async simulateCheckout() {
    // Pick a random gym with open check-ins
    const gymResult = await pool.query(`
      SELECT DISTINCT gym_id FROM checkins
      WHERE checked_out IS NULL
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (gymResult.rows.length === 0) return;

    const gymId = gymResult.rows[0].gym_id;

    // Pick a random open check-in from that gym
    const checkinResult = await pool.query(
      `
      SELECT c.id, m.name, g.name as gym_name, g.capacity
      FROM checkins c
      JOIN members m ON m.id = c.member_id
      JOIN gyms g ON g.id = c.gym_id
      WHERE c.gym_id = $1 AND c.checked_out IS NULL
      ORDER BY RANDOM()
      LIMIT 1
    `,
      [gymId],
    );

    if (checkinResult.rows.length === 0) return;

    const checkin = checkinResult.rows[0];

    // Update check-out
    await pool.query(
      `
      UPDATE checkins
      SET checked_out = NOW()
      WHERE id = $1
    `,
      [checkin.id],
    );

    // Get current occupancy after checkout
    const occupancyResult = await pool.query(
      `
      SELECT COUNT(*) as count FROM checkins
      WHERE gym_id = $1 AND checked_out IS NULL
    `,
      [gymId],
    );

    const currentOccupancy = occupancyResult.rows[0].count;
    const occupancyPct = Math.round(
      (100 * currentOccupancy) / checkin.capacity,
    );

    // Broadcast event
    this.broadcastFn({
      type: "CHECKOUT_EVENT",
      gym_id: gymId,
      gym_name: checkin.gym_name,
      member_name: checkin.name,
      timestamp: new Date().toISOString(),
      current_occupancy: currentOccupancy,
      capacity_pct: occupancyPct,
    });
  }
}
