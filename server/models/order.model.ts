import mongoose, { Schema, Document, Model } from "mongoose";
import { IUser } from "./user.model";

export interface IOrder extends Document {
  userId: string;
  courseId: string;
  payment_info?: object;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: String,
      required: true,
    },
    courseId: {
      type: String,
      required: true,
    },
    payment_info: {
      type: Object,
    },
  },
  { timestamps: true }
);

const OrderModel: Model<IOrder> = mongoose.model("Order", orderSchema);

export default OrderModel;
