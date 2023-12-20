require("dotenv").config();
import express from "express";
export const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./middleware/error";
import userRouter from "./routes/user.routes";
import courseRouter from "./routes/course.routes";
import orderRouter from "./routes/order.routes";
import notificationRouter from "./routes/notification.routes";
import analyticsRouter from "./routes/analytics.routes";
import layoutRouter from "./routes/layout.routes";

//BodyParser
app.use(express.json({ limit: "50mb" }));

//CookieParser
app.use(cookieParser());

//Cors => Cross Origin Resource Sharing
app.use(
  cors({
    origin: process.env.ORIGIN,
  })
);

//Routes
app.use(
  "/api/v1",
  userRouter,
  courseRouter,
  orderRouter,
  notificationRouter,
  analyticsRouter,
  layoutRouter
);

//Testing API
app.get("/test", (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "API is working",
  });
});

//Unknown Route
app.all("*", (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server`);
  res.status(404).json({
    success: false,
    message: err.message,
  });
  next(err);
});

app.use(ErrorMiddleware);
