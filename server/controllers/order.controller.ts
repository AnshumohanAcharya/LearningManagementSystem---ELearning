import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import OrderModel, { IOrder } from "../models/order.model";
import userModel from "../models/user.model";
import courseModel from "../models/course.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import { getAllOrdersService, newOrder } from "../services/order.service";

//Create order
export const createOrder = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, payment_info } = req.body as IOrder;
      const user = await userModel.findById(req.user?._id);
      const courseExistsInUser = user?.courses.some(
        (course: any) => course._id.toString() === courseId
      );
      if (courseExistsInUser) {
        return next(
          new ErrorHandler(400, "You already have purchased this course")
        );
      }
      const course = await courseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler(404, "Course not found"));
      }
      const data: any = {
        userId: req.user?._id,
        courseId: course._id,
        payment_info,
      };
      const mailData = {
        order: {
          _id: course._id.toString().slice(0, 6),
          name: course.name,
          price: course.price,
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        },
      };

      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/order-confirmation.ejs"),
        { order: mailData }
      );
      try {
        if (user) {
          await sendMail({
            email: user.email,
            subject: "Order Confirmation",
            template: "order-confirmation.ejs",
            data: mailData,
          });
        }
      } catch (err: any) {
        return next(new ErrorHandler(500, err.message));
      }

      user?.courses.push(course?._id);

      await user?.save();
      await NotificationModel.create({
        userId: user?._id,
        title: "New Order",
        message: `You have a new order from ${course.name} course`,
      });
      course.purchased ? (course.purchased += 1) : course.purchased;
      newOrder(data, res, next);
    } catch (err: any) {
      return next(new ErrorHandler(500, err.message));
    }
  }
);

//Get all orders For Admin
export const getAllOrders = CatchAsyncError(
  async ( req: Request,res: Response, next: NextFunction) => {
    try {
      getAllOrdersService(res);
    } catch (err: any) {
      return next(new ErrorHandler(500, err.message));
    }
  }
);
