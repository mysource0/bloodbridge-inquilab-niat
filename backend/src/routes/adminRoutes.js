// backend/src/routes/adminRoutes.js
import express from 'express';
import {
  login,
  createBridgeForPatient,
  closeEmergency,
  requestBridgeTransfusion,
  getDashboardStats,
  getBloodGroupStats,
  getPatients,
  getActiveEmergencies,
  getBloodBridges,
  getDuePatients,
  getLeaderboard,
  getInboxMessages,
  escalateEmergency,
  resolveInboxMessage,
  getConfig
} from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// Public (no auth needed)
router.post('/login', login);

// All routes below this require auth
router.use(authMiddleware);

// --- DASHBOARD GET ROUTES ---
router.get('/config', checkRole(['Admin']), getConfig);
router.get('/stats', checkRole(['Admin']), getDashboardStats);
router.get('/stats/blood-groups', checkRole(['Admin']), getBloodGroupStats);
router.get('/patients', checkRole(['Admin']), getPatients);
router.get('/patients/due', checkRole(['Admin']), getDuePatients);
router.get('/emergencies', checkRole(['Admin']), getActiveEmergencies);
router.get('/bridges', checkRole(['Admin']), getBloodBridges);
router.get('/leaderboard', checkRole(['Admin']), getLeaderboard);
router.get('/inbox', checkRole(['Admin']), getInboxMessages);

// --- ACTION ROUTES ---
router.post('/patients/:patientId/create-bridge', checkRole(['Admin']), createBridgeForPatient);
router.post('/emergencies/:requestId/close', checkRole(['Admin']), closeEmergency);
router.post('/emergencies/:requestId/escalate', checkRole(['Admin']), escalateEmergency);
router.post('/bridges/:bridgeId/request', checkRole(['Admin']), requestBridgeTransfusion);
router.post('/inbox/:messageId/resolve', checkRole(['Admin']), resolveInboxMessage);

export default router;