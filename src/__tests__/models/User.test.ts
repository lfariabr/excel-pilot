// __tests__/models/User.test.ts

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import UserModel from '../../models/User';

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
    if (mongoose.connection.db) {
      await mongoose.connection.dropDatabase();
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('Email validation', () => {
    it('should not allow duplicate emails', async () => {
      expect.assertions(1);
      const plainPassword = 'mySecurePassword123';
      await UserModel.create({
        name: 'Test User',
        email: 'duplicate@example.com',
        password: plainPassword,
        role: 'casual'
      })
      
      // Try to create another user with the same email
      await expect(UserModel.create({
        name: 'Another User',
        email: 'duplicate@example.com',
        password: 'anotherPassword',
        role: 'casual'
      })).rejects.toThrow(/duplicate key error|E11000/);
    });

    it('should lowercase email before saving', async () => {
      const user = await UserModel.create({
        name: 'Test User',
        email: 'UPPERCASE@EXAMPLE.COM',
        password: 'password123',
        role: 'casual'
      });
      
      expect(user.email).toBe('uppercase@example.com');
    });

    it('should enforce required fields', async () => {
      await expect(
        UserModel.create({
          email: 'x@x.com'
        })).rejects.toThrow();
    });
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
    
    expect(savedUser).not.toBeNull();
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

  it('should not rehash password if unchanged', async() => {
    const user = await UserModel.create({
      name: 'Test User',
      email: 'unchanged@example.com',
      password: 'initialPassword',
      role: 'casual'
    });

    const originalHash = user.password;

    user.name = "Updated Name";
    await user.save();

    const updated = await UserModel.findById(user._id).select('+password');
    expect(updated?.password).toBe(originalHash);
    expect(updated?.name).toBe("Updated Name");
  });
});
});