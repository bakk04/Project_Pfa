import mongoose, { Schema, model, models } from 'mongoose';

const UserSchema = new Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
  },
  email: {
    type: String,
    unique: true,
    required: [true, 'Email is required'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false, // Don't return password by default
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required'],
  },
  profileImage: {
    type: String,
    default: '',
  },
  healthData: {
    weight: Number,
    height: Number,
    gender: Number, // 0 for female, 1 for male
    smoking: String,
    diabetic: String,
    familyHistory: String,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

const User = models.User || model('User', UserSchema);

export default User;
