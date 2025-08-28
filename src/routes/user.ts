import { Router} from "express";
import { Types } from "mongoose";
import UserModel from "../models/User";

const router = Router();

// GET /users (list)
// curl http://localhost:4000/users
router.get("/", async (_req, res, next) => {
    try {
        const users = await UserModel.find().lean();
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// Get../:id
// curl http://localhost:4000/users/<_id_here>
router.get("/:id", async (req, res, next) => {
    try {
        const {id } = req.params;
        if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
        const user = await UserModel.findById(id).lean();
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (error) {
        next(error);
    }
})

// Post
// curl -X POST http://localhost:4000/users \
//   -H "Content-Type: application/json" \
//   -d '{"name":"Luis","email":"luis@example.com","role":"admin"}'
router.post("/", async (req, res, next) => {
    try {
        const { name, email, role } = req.body;
        if (!name || !email || !role) return res.status(400).json({ error: "Missing required fields" });
        
        const exists = await UserModel.findOne({ email }).lean();
        if (exists) return res.status(409).json({ error: "User already exists" });

        const user = await UserModel.create({ name, email, role });
        res.status(201).json(user);
    } catch (error) {
        next(error);
    }
})

// Patch
// curl -X PATCH http://localhost:4000/users/<_id_here> \
//   -H "Content-Type: application/json" \
//   -d '{"name":"Luis","email":"luis@example.com","role":"admin"}'
router.patch("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
        const doc = await UserModel.findByIdAndUpdate(id, { $set: req.body }, { new: true }).lean();
        if (!doc) return res.status(404).json({ error: "Not found" });
        res.json(doc);
    } catch (error) {
        next(error);
    }
})

// Delete
// curl -X DELETE http://localhost:4000/users/<_id_here>
router.delete("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" })
        const result = await UserModel.findByIdAndDelete(id);
        res.json({ ok: !!result });
    } catch (e) { next(e); }
});

export default router;
