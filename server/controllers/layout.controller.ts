import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import layoutModel from "../models/layout.model";
import cloudinary from "cloudinary";

//Create Layout
export const createLayout = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body;
      const isTypeExists = await layoutModel.findOne({ type });
      if (isTypeExists) {
        return next(new ErrorHandler(400, `${type} already exists`));
      }
      if (type === "Banner") {
        const { image, title, subTitle } = req.body;
        const myCloud = await cloudinary.v2.uploader.upload(image, {
          folder: "layout",
        });
        const banner = {
          image: {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          },
          title,
          subTitle,
        };
        await layoutModel.create(banner);
      }
      if (type === "FAQ") {
        const { faq } = req.body;
        const faqItems = await Promise.all(
          faq.map(async (item: any) => {
            return {
              question: item.question,
              answer: item.answer,
            };
          })
        );
        await layoutModel.create({ type: "FAQ", faq: faqItems });
      }
      if (type === "Category") {
        const { categoryData } = req.body;
        const categoriesItems = await Promise.all(
          categoryData.map(async (item: any) => {
            return {
              title: item.title,
            };
          })
        );
        await layoutModel.create({
          type: "Category",
          categoryData: categoriesItems,
        });
      }
      res.status(201).json({
        success: true,
        message: "Layout created successfully",
      });
    } catch (Error: any) {
      next(new ErrorHandler(500, Error.message));
    }
  }
);

//Edit layout
export const editLayout = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body;
      if (type === "Banner") {
        const bannerData: any = await layoutModel.findOne({ type: "Banner" });
        const { image, title, subTitle } = req.body;
        if (bannerData) {
          await cloudinary.v2.uploader.destroy(bannerData.image.public_id);
        }
        const myCloud = await cloudinary.v2.uploader.upload(image, {
          folder: "layout",
        });
        const banner = {
          image: {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          },
          title,
          subTitle,
        };
        await layoutModel.findByIdAndUpdate(bannerData?._id, { banner });
      }
      if (type === "FAQ") {
        const { faq } = req.body;
        const faqItem = await layoutModel.findOne({ type: "FAQ" });
        const faqItems = await Promise.all(
          faq.map(async (item: any) => {
            return {
              question: item.question,
              answer: item.answer,
            };
          })
        );
        await layoutModel.findByIdAndUpdate(faqItem?._id, {
          type: "FAQ",
          faq: faqItems,
        });
      }
      if (type === "Category") {
        const { categoryData } = req.body;
        const categoryItem = await layoutModel.findOne({ type: "Category" });
        const categoriesItems = await Promise.all(
          categoryData.map(async (item: any) => {
            return {
              title: item.title,
            };
          })
        );
        await layoutModel.findByIdAndUpdate(categoryItem?._id, {
          type: "Category",
          categoryData: categoriesItems,
        });
      }
      res.status(201).json({
        success: true,
        message: "Layout updated successfully",
      });
    } catch (Error: any) {
      next(new ErrorHandler(500, Error.message));
    }
  }
);

//Get Layout
export const getLayoutByType = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body;
      const layout = await layoutModel.findOne({ type });
      res.status(200).json({
        success: true,
        layout,
      });
    } catch (Error: any) {
      next(new ErrorHandler(500, Error.message));
    }
  }
);
