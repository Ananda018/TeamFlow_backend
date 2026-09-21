import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import { DB_NAME } from "../constants.js";

export default async function connectDB(uri, { legacy = false } = {}) {
  await mongoose.connect(uri, {
    ...(legacy ? { dbName: DB_NAME } : {}),
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });
  logger.info("database.connected");
  return mongoose.connection;
}
