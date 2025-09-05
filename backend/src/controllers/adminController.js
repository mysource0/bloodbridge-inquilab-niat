// backend/src/controllers/adminController.js
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import db from '../config/db.js';
import bridgeService from '../services/bridgeService.js';
import bridgeCoordinationService from '../services/bridgeCoordinationService.js'; 
import emergencyService from '../services/emergencyService.js';

/**
 * Admin Login
 */
export const login = async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ message: 'Phone and password are required' });
  }
  try {
    // Demo admin login (for prototype)
    if (phone === config.adminDemoPhone && password === 'admin123') {
      const token = jwt.sign({ phone, role: 'Admin' }, config.jwtSecret, { expiresIn: '8h' });
      console.log(`Login successful for demo admin: ${phone}`);
      return res.json({ token });
    }
    // In a real app, you would have hashed password validation here
    const { rows } = await db.query(
      'SELECT * FROM users WHERE phone = $1 AND role = $2',
      [phone, 'Admin']
    );
    if (rows.length === 0 || rows[0].password !== password) {
      console.warn('Login failed for phone:', phone);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ phone, role: 'Admin' }, config.jwtSecret, { expiresIn: '8h' });
    console.log(`Login successful for user: ${phone}`);
    return res.json({ token });

  } catch (err) {
    console.error('Login error:', { error: err.message, phone });
    return res.status(500).json({ message: 'Server error during login' });
  }
};

/**
 * Create a Blood Bridge for a Patient
 */
export const createBridgeForPatient = async (req, res) => {
  const { patientId } = req.params;
  try {
    const { rows: [patient] } = await db.query(
      'SELECT * FROM patients WHERE id = $1',
      [patientId]
    );

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    if (patient.status === 'bridged') {
      return res.status(400).json({ message: 'Patient already has a bridge.' });
    }

    const { rows: [bridge] } = await db.query(
      'INSERT INTO blood_bridges (patient_id, name, blood_group, city) VALUES ($1, $2, $3, $4) RETURNING id',
      [patient.id, `${patient.name}'s Bridge`, patient.blood_group, patient.city]
    );

    const result = await bridgeService.populateNewBridge(
      bridge.id,
      patient.city,
      patient.blood_group,
      patient.pincode
    );

    await db.query(
      "UPDATE patients SET status = 'bridged' WHERE id = $1",
      [patientId]
    );
    console.log(`ADMIN ACTION: Created and populated Bridge ${bridge.id} with ${result.count} members.`);
    res.json({
      success: true,
      message: `Blood Bridge created and populated with ${result.count} top donors.`
    });
  } catch (error) {
    console.error('Error creating bridge for patient:', error);
    await db.query( "UPDATE patients SET status = 'pending_verification' WHERE id = $1", [patientId]);
    res.status(500).json({ error: 'Failed to create and populate bridge.' });
  }
};

/**
 * Close Emergency Request
 */
export const closeEmergency = async (req, res) => {
  const { requestId } = req.params;
  try {
    const { rowCount } = await db.query(
      "UPDATE emergency_requests SET status = 'closed' WHERE id = $1 AND status = 'active'",
      [requestId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: "Active request not found or already closed."})
    }
    console.log(`ADMIN ACTION: Closed emergency request ${requestId}`);
    res.json({ success: true, message: 'Request successfully closed.' });
  } catch (error) {
    console.error(`Error closing emergency ${requestId}:`, error);
    res.status(500).json({ error: 'Failed to close request.' });
  }
};

/**
 * Triggers a transfusion request for a patient in a Blood Bridge.requestBridgeTransfusion
 */
export const requestBridgeTransfusion = async (req, res) => {
  const { bridgeId } = req.params;
  try {
    // Use the imported instance directly
    const result = await bridgeCoordinationService.requestTransfusion(bridgeId);
  // --- END OF FIX ---
    console.log(`ADMIN ACTION: Triggered transfusion request for bridge ${bridgeId}`);
    res.json(result);
  } catch (error) {
    console.error(`Error requesting bridge transfusion for ${bridgeId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to send bridge request.' });
  }
};

/**
 * Fetches the four main statistics for the StatCards on the dashboard.
 */
export const getDashboardStats = async (req, res) => {
  try {
    const [
      { rows: [totalDonors] },
      { rows: [activeDonors] },
      { rows: [pendingPatients] },
      { rows: [atRisk] }
    ] = await Promise.all([
      db.query("SELECT COUNT(*) as count FROM users WHERE user_type = 'donor'"),
      db.query("SELECT COUNT(*) as count FROM users WHERE user_type = 'donor' AND availability_status = 'available'"),
      db.query("SELECT COUNT(*) as count FROM patients WHERE status = 'pending_verification'"),
      db.query("SELECT COUNT(*) as count FROM emergency_requests WHERE status = 'active'")
    ]);
    
    res.json({
      total_donors: parseInt(totalDonors.count, 10),
      active_donors: parseInt(activeDonors.count, 10),
      pending_patients: parseInt(pendingPatients.count, 10),
      patients_at_risk: parseInt(atRisk.count, 10),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
};

/**
 * Fetches the count of donors for each blood group for the chart.
 */
export const getBloodGroupStats = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT blood_group, COUNT(*) as count 
       FROM users 
       WHERE user_type = 'donor' AND blood_group IS NOT NULL AND blood_group != 'Unknown'
       GROUP BY blood_group 
       ORDER BY blood_group`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching blood group stats:', error);
    res.status(500).json({ error: 'Failed to fetch blood group stats.' });
  }
};

/**
 * Fetches patients with 'pending_verification' status for the Patients tab.
 */

export const getPatients = async (req, res) => {
  try {
    // --- THIS IS THE CORRECTED QUERY ---
    // Instead of a risky subquery, we use a LEFT JOIN. This is safer and more efficient.
    // It correctly handles the case where a patient has no bridge yet (member_count will be 0).
    const query = `
      SELECT 
        p.id, p.name, p.phone, p.blood_group, p.city, p.status, p.condition,
        p.last_transfusion_date, p.frequency_in_days,
        p.last_transfusion_date + (p.frequency_in_days || ' days')::interval AS next_due_date,
        COUNT(bm.id) as bridge_member_count
      FROM 
        patients p
      LEFT JOIN 
        blood_bridges bb ON p.id = bb.patient_id
      LEFT JOIN 
        bridge_members bm ON bb.id = bm.bridge_id
      GROUP BY
        p.id
      ORDER BY 
        p.created_at DESC
    `;
    // --- END OF CORRECTION ---
    
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients.' });
  }
};

/**
 * Fetches all 'active' emergencies for the Emergencies tab.
 */
export const getActiveEmergencies = async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, patient_name, blood_group, status, city FROM emergency_requests WHERE status = 'active' ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching active emergencies:', error);
    res.status(500).json({ error: 'Failed to fetch active emergencies.' });
  }
};

/**
 * Fetches all created Blood Bridges for the Blood Bridges tab.
 */
export const getBloodBridges = async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT bb.id, bb.blood_group, bb.city, p.name as patient_name
             FROM blood_bridges bb
             JOIN patients p ON bb.patient_id = p.id
             WHERE bb.active = true
             ORDER BY p.name`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching blood bridges:', error);
        res.status(500).json({ error: 'Failed to fetch blood bridges.' });
    }
};

/**
 * Fetches patients who are due for a transfusion.
 * Logic: Finds patients where today's date is past their last transfusion + frequency.
 */
export const getDuePatients = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, blood_group, city, last_transfusion_date, frequency_in_days
       FROM patients
       WHERE 
         status = 'bridged' AND 
         last_transfusion_date IS NOT NULL AND 
         frequency_in_days IS NOT NULL AND
         (last_transfusion_date + frequency_in_days * INTERVAL '1 day') <= NOW()`
    );
    res.json(rows);
  } catch (error){
    console.error('Error fetching due patients:', error);
    res.status(500).json({ error: 'Failed to fetch due patients.' });
  }
};

/**
 * Fetches the top 10 donors for the gamification leaderboard.
 */
export const getLeaderboard = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT name, gamification_points, city 
       FROM users 
       WHERE user_type = 'donor' 
       ORDER BY gamification_points DESC 
       LIMIT 10`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard data.' });
  }
};

// --- Other Endpoints (Placeholders for now) ---
export const getConfig = async (req, res) => { res.json({ message: "Config placeholder" }); };
export const getInboxMessages = async (req, res) => {
  try {
    // This query selects all messages that an admin has not yet marked as 'resolved'.
    const { rows } = await db.query(
      "SELECT id, user_phone, user_message, reason, created_at FROM inbox_messages WHERE status = 'pending' ORDER BY created_at ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching inbox messages:', error);
    res.status(500).json({ error: 'Failed to fetch inbox messages.' });
  }
};
export const escalateEmergency = async (req, res) => {
  const { requestId } = req.params;
  try {
    const result = await emergencyService.escalateRequest(requestId);
    console.log(`ADMIN ACTION: Escalated emergency request ${requestId}`);
    res.json(result);
  } catch (error) {
    console.error(`Error escalating emergency ${requestId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to escalate emergency.' });
  }
};
export const resolveInboxMessage = async (req, res) => { res.status(501).json({ message: "Not implemented" }); };