require("dotenv").config();
import { redis } from "../utils/redis";
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";

//Authenticated User
export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const access_token = req.cookies.access_token;
    if (!access_token) {
      return next(
        new ErrorHandler(400, "Please login to access this resource")
      );
    }

    const decoded = jwt.verify(
      access_token,
      process.env.ACCESS_TOKEN as string
    ) as JwtPayload;

    if (!decoded) {
      return next(new ErrorHandler(400, "Access token is not valid!"));
    }

    const user = await redis.get(decoded.id);

    if (!user) {
      return next(new ErrorHandler(400, "Please login to access this resource"));
    }

    req.user = JSON.parse(user);
    next();
  }
);

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || "")) {
      return next(
        new ErrorHandler(403, "You are not authorized to access this resource")
      );
    }
    next();
  };
};
