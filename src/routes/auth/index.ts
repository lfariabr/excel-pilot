// routes/auth/index.ts
import { Router } from 'express';
import queriesRouter from './queries';
import mutationsRouter from './mutations';

const router = Router();

router.use('/', queriesRouter);
router.use('/', mutationsRouter);

export default router;