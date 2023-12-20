import mongoose from "mongoose";
require("dotenv").config();

const dbUrl: string = process.env.DB_URI || "";

const connectDB = async () => {
  try {
    (await mongoose.connect(dbUrl)).isObjectIdOrHexString((data: any) => {
      console.log(`MongoDB Connected: ${data.connection.host}`);
    });
  } catch (error: any) {
    console.log(`Error: ${error.message}`);
    setTimeout(connectDB, 5000);
  }
};

export default connectDB;