import { Router} from "express";
import { Types } from "mongoose";
import UserModel from "../models/User";
import { AppError } from "../utils/errorHandler";
import { requireAuth } from "../utils/guards";

const router = Router();

// GET /users (list)
// -----------------------------------------------------
// curl http://localhost:4000/users
router.get("/", requireAuth, async (_req, res, next) => {
    try {
        const users = await UserModel.find().lean();
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// GET../:id
// -----------------------------------------------------
// curl http://localhost:4000/users/<_id_here>
router.get("/:id", requireAuth, async (req, res, next) => {
    try {
        const {id } = req.params;
        if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
        const user = await UserModel.findById(id).lean();
        if (!user) throw new AppError(404, "User not found");
        res.json(user);
    } catch (error) {
        next(error);
    }
})

// POST
// -----------------------------------------------------
// curl -X POST http://localhost:4000/users \
//   -H "Content-Type: application/json" \
//   -d '{"name":"Luis","email":"luis@example.com","role":"admin"}'
router.post("/", async (req, res, next) => {
    try {
        const { name, email, role } = req.body;
        if (!name || !email || !role) throw new AppError(400, "Missing required fields");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'Invalid email format');
        if (!['user', 'admin'].includes(role)) throw new AppError(400, 'Invalid role');
        
        const exists = await UserModel.findOne({ email }).lean();
        if (exists) throw new AppError(409, "User already exists");

        const user = await UserModel.create({ name, email, role });
        res.status(201).json(user);
    } catch (error) {
        next(error);
    }
})

// PATCH
// -----------------------------------------------------
// curl -X PATCH http://localhost:4000/users/<_id_here> \
//   -H "Content-Type: application/json" \
//   -d '{"name":"Luis","email":"luis@example.com","role":"admin"}'
router.patch("/:id", requireAuth,async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
        const doc = await UserModel.findByIdAndUpdate(id, { $set: req.body }, { new: true }).lean();
        if (!doc) throw new AppError(404, "Not found");
        res.json(doc);
    } catch (error) {
        next(error);
    }
})

// DELETE
// -----------------------------------------------------
// curl -X DELETE http://localhost:4000/users/<_id_here>
router.delete("/:id", requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) throw new AppError(400, "Invalid id");
        const result = await UserModel.findByIdAndDelete(id);
        res.json({ ok: !!result });
    } catch (e) { next(e); }
});

export default router;
