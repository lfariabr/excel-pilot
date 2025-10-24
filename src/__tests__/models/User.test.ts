// __tests__/models/User.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import UserModel from '../../../src/models/User';

describe('User Model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  describe('Password Hashing', () => {
  it('should hash password before saving', async () => {
    const plainPassword = 'mySecurePassword123';
    
    const user = await UserModel.create({
      name: 'Test User',
      email: 'test@example.com',
      password: plainPassword,
      role: 'casual'
    });

    // Retrieve with password field
    const savedUser = await UserModel.findById(user._id).select('+password');
    
    expect(savedUser?.password).not.toBe(plainPassword);
    expect(savedUser?.password).toMatch(/^\$2b\$/); // bcrypt format
  });

  it('should correctly compare passwords', async () => {
    const user = await UserModel.create({
      name: 'Auth Test',
      email: 'auth@example.com',
      password: 'correctPassword',
      role: 'admin'
    });

    const userWithPassword = await UserModel
      .findById(user._id)
      .select('+password');

    const isMatch = await userWithPassword!.comparePassword('correctPassword');
    const isNotMatch = await userWithPassword!.comparePassword('wrongPassword');

    expect(isMatch).toBe(true);
    expect(isNotMatch).toBe(false);
  });
});
});