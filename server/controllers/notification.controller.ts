import NotificationModel from "../models/notification.model";
import { NextFunction, Response, Request } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import cron from "node-cron";

export const getNotifications = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notifications = await NotificationModel.find().sort({
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        notifications,
      });
    } catch (Error: any) {
      return next(new ErrorHandler(500, Error.message));
    }
  }
);

//Update notification status -- ONly Admin
export const updateNotificationStatus = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notification = await NotificationModel.findById(req.params.id);
      if (!notification) {
        return next(new ErrorHandler(404, "Notification not found"));
      } else {
        notification.status
          ? (notification.status = "read")
          : notification.status;
      }
      await notification.save();
      res.status(201).json({
        success: true,
        notification,
      });
    } catch (Error: any) {
      return next(new ErrorHandler(500, Error.message));
    }
  }
);

//Delete notification -- Only Admin
cron.schedule("0 0 0 * * *", async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await NotificationModel.deleteMany({
    status: "read",
    createdAt: { $lt: thirtyDaysAgo },
  });
  console.log("Notifications deleted");
});
