import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import courseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";

//Upload Course
export const uploadCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "courses",
        });

        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }
      createCourse(data, res, next);
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

//Edit Course
export const editCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        await cloudinary.v2.uploader.destroy(data.thumbnail.public_id);
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "courses",
        });

        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }
      const courseId = req.params.id;
      const course = await courseModel.findByIdAndUpdate(
        courseId,
        {
          $set: data,
        },
        { new: true }
      );
      res.status(201).json({
        success: true,
        message: "Course updated successfully",
        course,
      });
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

//Get single course --Without purchasing
export const getSingleCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;
      const isCacheExist = await redis.get(courseId);
      if (isCacheExist) {
        return res.status(200).json({
          success: true,
          course: JSON.parse(isCacheExist),
        });
      } else {
        const course = await courseModel
          .findById(courseId)
          .select(
            "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
          );
        await redis.set(courseId, JSON.stringify(course), "EX" , 604800); //7 days
        res.status(200).json({
          success: true,
          course,
        });
      }
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

//Get All courses --Without purchasing
export const getAllCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courses = await courseModel
        .find()
        .select(
          "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
        );
      res.status(200).json({
        success: true,
        courses,
      });
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

//Get course content --Only for valid user
export const getCourseContentByUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;

      const courseExists = userCourseList?.find(
        (course: any) => course._id.toString() === courseId
      );
      if (!courseExists) {
        return next(
          new ErrorHandler(404, "You are not authorized to access this course")
        );
      }
      const course = await courseModel.findById(courseId);
      const content = course?.courseData;
      res.status(200).json({
        success: true,
        content,
      });
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

//add question in course - FAQ
interface IQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}

export const addQuestion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId } = req.body as IQuestionData;
      const course = await courseModel.findById(courseId);
      const courseData = course?.courseData;
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler(400, "Invalid content Id"));
      }
      const content = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );
      if (!content) {
        return next(new ErrorHandler(400, "Invalid content Id"));
      }
      const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: [],
      };

      content.questions.push(newQuestion);

      await NotificationModel.create({
        user: req.user?._id,
        title: "New Question reveived!",
        message: `${req.user?.name} has asked a question in ${course?.name}`,
      });
      await course?.save();
      res.status(200).json({
        success: true,
        message: "Question added successfully",
        course,
      });
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

//Add answer in course question
interface IAnswerData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}

export const addAnswer = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, courseId, contentId, questionId } =
        req.body as IAnswerData;
      const course = await courseModel.findById(courseId);
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler(400, "Invalid content Id"));
      }
      const content = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );
      if (!content) {
        return next(new ErrorHandler(400, "Invalid content Id"));
      }
      const question = content?.questions?.find((item: any) =>
        item._id.equals(questionId)
      );
      if (!question) {
        return next(new ErrorHandler(400, "Invalid question Id"));
      }
      const newAnswer: any = {
        user: req.user,
        answer,
      };

      question.questionReplies.push(newAnswer);

      await course?.save();

      if (req.user?._id === question.user._id) {
        //Create a notification
        await NotificationModel.create({
          user: req.user?._id,
          title: "New Answer reveived!",
          message: `${req.user?.name} has answered in ${course?.name}`,
        });
      } else {
        const data = {
          name: question.user.name,
          title: content.title,
        };
        const html = await ejs.renderFile(
          path.join(__dirname, "../mails/question-reply.ejs"),
          data
        );
        try {
          await sendMail({
            email: question.user.email,
            subject: "Question Reply",
            template: "question-reply.ejs",
            data,
          });
        } catch (err: any) {
          return next(new ErrorHandler(err.message, 500));
        }
      }
      res.status(200).json({
        success: true,
        message: "Answer added successfully",
        course,
      });
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

//Add review in course
interface IReviewData {
  rating: number;
  review: string;
  userId: string;
}

export const addReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const { rating, review, userId } = req.body as IReviewData;
      const courseId = req.params.id;
      const courseExists = userCourseList?.some(
        (course: any) => course._id.toString() === courseId.toString()
      );
      if (!courseExists) {
        return next(
          new ErrorHandler(404, "You are not authorized to access this course")
        );
      }
      const course = await courseModel.findById(courseId);
      const courseReviews = course?.reviews;
      const newReview: any = {
        user: req.user,
        rating,
        comment: review,
      };
      courseReviews?.push(newReview);
      let avg = 0;
      courseReviews?.forEach((review) => {
        avg += review.rating;
      });
      if (course) {
        course.ratings = avg / course.reviews.length;
      }
      await course?.save();
      const notification = {
        title: "New Review reveived!",
        message: `${req.user?.name} has reviewed in ${course?.name}`,
      };
      //Create Notification
      res.status(200).json({
        success: true,
        message: "Review added successfully",
        course,
      });
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

interface IReviewData {
  comment: string;
  courseId: string;
  reviewId: string;
}

//Add reply in review
export const addReplyToReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { comment, courseId, reviewId } = req.body as IReviewData;
      const course = await courseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler(404, "Course not found"));
      }
      const review = course?.reviews?.find(
        (item: any) => item._id.toString() === reviewId
      );
      if (!review) {
        return next(new ErrorHandler(404, "Review not found"));
      }
      const replyData: any = {
        user: req.user,
        comment,
      };
      if (!review.commentReplies) review.commentReplies = [];
      review.commentReplies.push(replyData);
      await course?.save();
      res.status(200).json({
        success: true,
        message: "Comment added successfully",
        course,
      });
    } catch (error: any) {
      next(new ErrorHandler(error.message, 500));
    }
  }
);

//Get All courses --Only for admin
export const getAllCoursesAdmin = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllCoursesService(res);
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

//Delete course --Only for admin
export const deleteCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const course = await courseModel.findById(id);
      if (!course) {
        return next(new ErrorHandler(404, "Course does not exist"));
      }
      await course.deleteOne({ id });
      await redis.del(id);
      res.status(200).json({
        success: true,
        message: "Course deleted successfully",
      });
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);
