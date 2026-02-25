import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    experiments: { type: Array, default: [] },
    configs: { type: Array, default: [] },
    history: { type: Array, default: [] },
    reports: { type: Array, default: [] },
    diseaseExperiments: { type: Array, default: [] },
  },
  { timestamps: true, collection: "users" }
);

export const User = mongoose.model("User", userSchema);
