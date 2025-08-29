// backend/src/routes/adminRoutes.js
import express from 'express';
import * as adminController from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// Public (no auth needed)
router.post('/login', adminController.login);

// All routes below this require auth
router.use(authMiddleware);

// ✅ UNCOMMENTED to make all GET endpoints live
router.get('/config', checkRole(['Admin']), adminController.getConfig);
router.get('/stats', checkRole(['Admin']), adminController.getDashboardStats);
router.get('/stats/blood-groups', checkRole(['Admin']), adminController.getBloodGroupStats);
router.get('/patients', checkRole(['Admin']), adminController.getPatients);
router.get('/emergencies', checkRole(['Admin']), adminController.getActiveEmergencies);
router.get('/bridges', checkRole(['Admin']), adminController.getBloodBridges);
router.get('/inbox', checkRole(['Admin']), adminController.getInboxMessages);

// Actions
router.post('/patients/:patientId/create-bridge', checkRole(['Admin']), adminController.createBridgeForPatient);
router.post('/emergencies/:requestId/close', checkRole(['Admin']), adminController.closeEmergency);
router.post('/emergencies/:requestId/escalate', checkRole(['Admin']), adminController.escalateEmergency);
router.post('/inbox/:messageId/resolve', checkRole(['Admin']), adminController.resolveInboxMessage);

export default router;