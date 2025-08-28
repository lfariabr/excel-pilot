import mongoose from 'mongoose';
import User from '../models/User';

async function createUser() {
  await mongoose.connect('mongodb://localhost:27017/conciApi');

  const u = await User.create({
    name: "Luis",
    email: "luis@example.com",
    role: "admin"
  });
  console.log(u);

  // Disconnect after done
  await mongoose.disconnect();
}
createUser().catch(console.error);