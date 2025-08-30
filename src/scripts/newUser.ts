// cd scripts
// npx ts-node newUser.ts

import mongoose from 'mongoose';
import UserModel from '../models/User';

async function createUser() {
  await mongoose.connect('mongodb://localhost:27017/ExcelPilot');

  const u = await UserModel.create({
    name: "Luis",
    email: "luis@example.com",
    role: "admin"
  });
  console.log(u);

  // Disconnect after done
  await mongoose.disconnect();
}
createUser().catch(console.error);