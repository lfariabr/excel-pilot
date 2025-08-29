import mongoose, { Document, Schema } from 'mongoose';
// • mongoose → the library that connects Node.js app to MongoDB.
// • Document → a Mongoose type that represents a MongoDB document (adds default fields like _id, createdAt, etc.).
// • Schema → lets us define the structure (shape) of documents in a collection.

import bcrypt from "bcrypt";

export interface User extends Document {
    // • TypeScript interface.
	// • By extending Document, it inherits all MongoDB document properties (like _id).
	// • Explicitly tell TypeScript: “Every user in my app must have name, email, and role as strings.”
	// • Gives type-checking at compile time (the beauty of catching mistakes before tge code even runs).
    // Example:
        // const u: User = { name: "Luis", email: "x@y.com" }; 
        // ❌ Error: role is missing

    name: string;
    email: string;
    role: "admin" | "casual" | "head" | "manager"; // admin, casual, head, manager
    
    // TO BE IMPLEMENTED:
    // status: string; // active, inactive
    password: string;
    comparePassword(candidate: string): Promise<boolean>;
    // building: [];

}

const userSchema = new Schema<User>({
    // • Defines how the MongoDB document looks in the Users collection
    // • Schema<User> means:
    //      - At runtime, MongoDB enforces the fields and their types
    //      - At compile time, Typescript enforces them too (thanks to the generic <User>)
    // required: true ensures the field must exist when saving to MongoDB

    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, required: true, enum: ["admin", "casual", "head", "manager"] },
    password: { type: String, required: true, select: false }, // select: false = never auto-return

},
    { timestamps: true } // adds createdAt and updatedAt fields automatically
);

userSchema.pre("save", async function (next){
    if (!this.isModified("password")) return next();
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
});

userSchema.methods.comparePassword = function (candidate: string) {
    return bcrypt.compare(candidate, this.password);
};

const UserModel = mongoose.model<User>('User', userSchema);
export default UserModel;

// 	• UserModel will be used in resolvers, controllers, or services to create/find/update users.
// Example:
// const newUser = await User.create({
//     name: "Luis",
//     email: "lfariaus@gmail.com",
//     role: "admin",
// })
