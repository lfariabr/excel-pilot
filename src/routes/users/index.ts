// routes/users/index.ts
import { Router } from "express";
import queriesRouter from "./queries";
import mutationsRouter from "./mutations";

const router = Router();

// Mount query routes (GET operations)
router.use("/", queriesRouter);

// Mount mutation routes (POST, PATCH, DELETE operations)
router.use("/", mutationsRouter);

export default router;