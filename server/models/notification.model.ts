import mongoose, { Document, Schema, Model } from "mongoose";

export interface INotification extends Document {
  title: string;
  status: string;
  message: string;
  userId: string;
}

const notificationSchema = new Schema<INotification>(
  {
    title: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "unread",
    },
    message: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const NotificationModel: Model<INotification> = mongoose.model(
  "Notification",
  notificationSchema
);
export default NotificationModel;
