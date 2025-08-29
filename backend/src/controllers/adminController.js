import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import db from '../config/db.js';
import bridgeService from '../services/bridgeService.js';

/**
 * Admin Login
 */
export const login = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    console.warn('Login attempt with missing credentials:', { phone, password });
    return res.status(400).json({ message: 'Phone and password are required' });
  }

  try {
    // Demo admin login (for prototype)
    if (phone === config.adminDemoPhone && password === 'admin123') {
      const token = jwt.sign({ phone, role: 'Admin' }, config.jwtSecret, { expiresIn: '1h' });
      console.log(`Login successful for demo admin: ${phone}`);
      return res.json({ token });
    }

    // Check if admin exists in DB
    const { rows } = await db.query(
      'SELECT * FROM users WHERE phone = $1 AND role = $2',
      [phone, 'Admin']
    );

    if (rows.length === 0) {
      console.warn('Login failed: No admin user found for phone:', phone);
      return res.status(401).json({ message: 'Invalid phone number or role' });
    }

    // Password check (⚠️ Plaintext for now, should be hashed in production)
    if (!rows[0].password || rows[0].password !== password) {
      console.warn('Login failed: Invalid password for phone:', phone);
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Issue token
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

    // Insert new bridge
    const { rows: [bridge] } = await db.query(
      'INSERT INTO blood_bridges (patient_id, name, blood_group, city) VALUES ($1, $2, $3, $4) RETURNING id',
      [patient.id, `${patient.name}'s Bridge`, patient.blood_group, patient.city]
    );

    // Populate bridge with donors
    const result = await bridgeService.populateNewBridge(
      bridge.id,
      patient.city,
      patient.blood_group,
      patient.pincode
    );

    // Update patient status
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

    // Rollback patient status in case of failure
    await db.query(
      "UPDATE patients SET status = 'pending_verification' WHERE id = $1",
      [patientId]
    );

    res.status(500).json({ error: 'Failed to create and populate bridge.' });
  }
};


/**
 * Close Emergency Request
 */
export const closeEmergency = async (req, res) => {
  const { requestId } = req.params;

  try {
    await db.query(
      "UPDATE emergency_requests SET status = 'closed' WHERE id = $1",
      [requestId]
    );
    console.log(`ADMIN ACTION: Closed emergency request ${requestId}`);
    res.json({ success: true, message: 'Request successfully closed.' });
  } catch (error) {
    console.error(`Error closing emergency ${requestId}:`, error);
    res.status(500).json({ error: 'Failed to close request.' });
  }
};


/**
 * Escalate Emergency
 */
export const escalateEmergency = async (req, res) => {
  const { requestId } = req.params;
  console.log(`ADMIN ACTION: Escalating emergency ${requestId}`);
  res.json({
    success: true,
    message: `Escalation for request ${requestId} has been initiated.`
  });
};


/**
 * Resolve Inbox Message
 */
export const resolveInboxMessage = async (req, res) => {
  const { requestId } = req.params;

  try {
    await db.query(
      "UPDATE inbox_messages SET status = 'resolved', resolved_at = NOW() WHERE id = $1",
      [requestId]
    );
    console.log(`ADMIN ACTION: Resolved inbox message ${requestId}`);
    res.json({ success: true, message: 'Message marked as resolved.' });
  } catch (error) {
    console.error(`Error resolving message ${requestId}:`, error);
    res.status(500).json({ error: 'Failed to resolve message.' });
  }
};


// 📝 Other endpoints remain unchanged
export const getDashboardStats = async (req, res) => { /* ... */ };
export const getBloodGroupStats = async (req, res) => { /* ... */ };
export const getConfig = async (req, res) => { /* ... */ };
export const getActiveEmergencies = async (req, res) => { /* ... */ };
export const getBloodBridges = async (req, res) => { /* ... */ };
export const getPatients = async (req, res) => { /* ... */ };
export const getInboxMessages = async (req, res) => { /* ... */ };

