// Import mongoose and Schema for MongoDB schema creation
import mongoose, { Schema } from "mongoose";
// Import jsonwebtoken to generate and verify JWT tokens
import jwt from "jsonwebtoken";
// Import bcrypt to hash and compare passwords
import bcrypt from "bcrypt";

// Define user schema with fields and validations
const userSchema = new Schema(
  {
    // Username of the user
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Email address of the user
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Full name of the user
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Profile picture (avatar) of the user
    avatar: {
      type: String,
      required: true,
    },
    // Optional cover image
    coverImage: {
      type: String,
    },

    // Password for user login (hashed before saving)
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    // Refresh token used for authentication
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt
);

// Pre-save hook to hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // If password not modified, skip
  this.password = await bcrypt.hash(this.password, 10); // Hash password with salt rounds = 10
  next(); // Continue saving
});

// Method to check if entered password is correct
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password); // Compare plain password with hashed one
};

// Method to generate access token (short-lived)
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id, // User ID
      email: this.email, // User email
      username: this.username, // Username
      fullName: this.fullName, // Full name
    },
    process.env.ACCESS_TOKEN_SECRET, // Secret key
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY, // Expiry time
    }
  );
};

// Method to generate refresh token (long-lived)
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id, // Only stores user ID
    },
    process.env.REFRESH_TOKEN_SECRET, // Secret key
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY, // Expiry time
    }
  );
};

// Export User model based on schema
export const User = mongoose.model("User", userSchema);
