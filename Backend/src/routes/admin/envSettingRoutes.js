import express from 'express';
import { getAllEnvSettings, updateEnvSettings, reloadServers } from '../../controllers/admin/envSettingController.js';
import { getServerEnv, updateServerEnv } from '../../controllers/admin/serverEnvController.js';
import { authMiddleware } from '../../core/auth/auth.middleware.js';
import { requireRoles } from '../../core/roles/role.middleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireRoles('ADMIN', 'SUPER_ADMIN'));

router.route('/')
    .get(getAllEnvSettings)
    .put(updateEnvSettings);

// Startup keys kept in Backend/.env (secrets masked, ENCRYPTION_KEY read-only). SUPER_ADMIN only.
router.route('/server')
    .get(requireRoles('SUPER_ADMIN'), getServerEnv)
    .put(requireRoles('SUPER_ADMIN'), updateServerEnv);

router.post('/reload', reloadServers);

export default router;
