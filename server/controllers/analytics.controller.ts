import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import userModel from "../models/user.model";
import { generateLast12MonthsData } from "../utils/analytics.generator";
import courseModel from "../models/course.model";
import OrderModel from "../models/order.model";

//User Analytics -- Only Admin can access this route
export const getUserAnalytics = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await generateLast12MonthsData(userModel);
      res.status(200).json({
        success: true,
        users,
      });
    } catch (Error: any) {
      next(new ErrorHandler(500, Error.message));
    }
  }
);

//Course Analytics -- Only Admin can access this route
export const getCourseAnalytics = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const courses = await generateLast12MonthsData(courseModel);
        res.status(200).json({
          success: true,
          courses,
        });
      } catch (Error: any) {
        next(new ErrorHandler(500, Error.message));
      }
    }
  );

//Order Analytics -- Only Admin can access this route
export const getOrderAnalytics = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const orders = await generateLast12MonthsData(OrderModel);
        res.status(200).json({
          success: true,
          orders,
        });
      } catch (Error: any) {
        next(new ErrorHandler(500, Error.message));
      }
    }
  );