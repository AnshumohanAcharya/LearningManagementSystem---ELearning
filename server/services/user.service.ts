import userModel from "../models/user.model";
import { Response } from "express";
import { redis } from "../utils/redis";

//get user by ID
export const getUserById = async (id: string, res: Response) => {
  const userJson = await redis.get(id);
  if (userJson) {
    const user = JSON.parse(userJson);
    return res.status(201).json({
      success: true,
      user,
    });
  }
};

// Get all users
export const getAllUsersService = async (res: Response) => {
  const users = await userModel.find().sort({ created: -1 });
  res.status(201).json({
    success: true,
    users,
  });
};

//Update Role (Admin side)
export const updateUserRoleService = async (
  id: string,
  role: string,
  res: Response
) => {
  const user = await userModel.findByIdAndUpdate(id, { role }, { new: true });
  res.status(201).json({
    success: true,
    message: "User role updated successfully",
    user,
  });
};
