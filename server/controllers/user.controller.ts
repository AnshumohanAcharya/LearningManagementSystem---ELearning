import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
require("dotenv").config();
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import {
  getAllUsersService,
  getUserById,
  updateUserRoleService,
} from "../services/user.service";
import cloudinary from "cloudinary";

//Register User
interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export const registrationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;
      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler(400, "Email already exists"));
      }
      const user: IRegistrationBody = {
        name,
        email,
        password,
      };
      const activationToken = createActivationToken(user);
      const activationCode = activationToken.activationCode;
      const data = {
        user: { name: user.name },
        activationCode,
      };
      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );
      try {
        await sendMail({
          email: user.email,
          subject: "Account Activation",
          template: "activation-mail.ejs",
          data,
        });
        res.status(201).json({
          success: true,
          message: `An email has been sent to ${user.email}. Please check your email to activate your account`,
          activationToken: activationToken.token,
        });
      } catch (Error: any) {
        return next(new ErrorHandler(400, Error.message));
      }
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

interface IActivatonToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivatonToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
  const token = jwt.sign(
    { user, activationCode },
    process.env.ACTIVATION_SECRET as Secret,
    { expiresIn: "5m" }
  );

  return { token, activationCode };
};

interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

//activate user
export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IActivationRequest;

      const newUser: { user: IUser; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IUser; activationCode: string };

      if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler(400, "Invalid activation code"));
      }

      const { name, email, password } = newUser.user;
      const existUser = await userModel.findOne({ email });
      if (existUser) {
        return next(new ErrorHandler(400, "Email already exists!"));
      }

      const user = await userModel.create({
        name,
        email,
        password,
      });
      res.status(201).json({
        success: true,
      });
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

//Login User
interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;
      if (!email || !password) {
        return next(
          new ErrorHandler(400, "Please enter your email & password")
        );
      }
      const user = await userModel.findOne({ email }).select("+password");
      if (!user) {
        return next(new ErrorHandler(400, "Invalid email or password"));
      }
      const isPasswordMatched = await user.comparePassword(password);
      if (!isPasswordMatched) {
        return next(new ErrorHandler(400, "Invalid email or password"));
      }
      sendToken(user, 200, res);
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", {
        maxAge: 1,
        expires: new Date(Date.now()),
        httpOnly: true,
      });
      res.cookie("refresh_token", "", {
        maxAge: 1,
        expires: new Date(Date.now()),
        httpOnly: true,
      });
      const userId = req.user?._id || "";
      redis.del(userId);
      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

//Update access token
export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refresh_token as string;
      if (!refresh_token) {
        return next(
          new ErrorHandler(400, "Please login to access this resource")
        );
      }
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;
      if (!decoded) {
        return next(new ErrorHandler(400, "Refresh token is not valid!"));
      }
      const user = await redis.get(decoded.id as string);
      if (!user) {
        return next(new ErrorHandler(400, "Please login to access these resources!"));
      }
      const newUser = JSON.parse(user);
      const accessToken = jwt.sign(
        { id: newUser._id },
        process.env.ACCESS_TOKEN as string,
        { expiresIn: "5m" }
      );

      const refreshToken = jwt.sign(
        { id: newUser._id },
        process.env.REFRESH_TOKEN as string,
        { expiresIn: "3d" }
      );

      req.user = newUser;

      res.cookie("access_token", accessToken, accessTokenOptions);
      res.cookie("refresh_token", refreshToken, refreshTokenOptions);

      //Cache maintainence
      await redis.set(newUser._id, JSON.stringify(newUser) , "EX" , 604800 ); //7 Days
      res.status(200).json({
        success: true,
        accessToken,
      });
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

//get user info
export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      getUserById(userId, res);
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

interface ISocialAuthBody {
  email: string;
  name: string;
  avatar: string;
}

//Social auth
export const socialAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body as ISocialAuthBody;
      const user = await userModel.findOne({ email });
      if (!user) {
        const newUser = await userModel.create({ email, name, avatar });
        sendToken(newUser, 200, res);
      } else {
        sendToken(user, 200, res);
      }
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

//UpdateUserInfo
interface IUpdateUserInfo {
  name?: string;
  email?: string;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { name, email } = req.body as IUpdateUserInfo;
      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler(400, "User does not exist"));
      }
      if (name) {
        user.name = name;
      }
      if (email) {
        user.email = email;
      }
      await redis.set(userId, JSON.stringify(user));
      res.status(200).json({
        success: true,
        message: "User updated successfully",
        user,
      });
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

//Update user password
interface IUpdatePassword {
  currentPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { currentPassword, newPassword } = req.body as IUpdatePassword;

      if (!currentPassword || !newPassword) {
        return next(
          new ErrorHandler(
            400,
            "Please enter your current password & new password"
          )
        );
      }
      const user = await userModel.findById(userId).select("+password");

      if (user?.password === undefined) {
        return next(new ErrorHandler(400, "User does not exist"));
      }
      const isPasswordMatched = await user?.comparePassword(currentPassword);
      if (!isPasswordMatched) {
        return next(new ErrorHandler(400, "Invalid password"));
      }
      user.password = newPassword;
      await user.save();
      await redis.set(userId, JSON.stringify(user));
      res.status(201).json({
        success: true,
        message: "Password updated successfully",
        user,
      });
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

//Update profile picture-Avatar
interface IUpdateAvatar {
  avatar: string;
}

export const updateAvatar = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { avatar } = req.body as IUpdateAvatar;
      const user = await userModel.findById(userId);
      if (avatar && user) {
        if (user?.avatar?.public_id) {
          await cloudinary.v2.uploader.destroy(user.avatar.public_id);
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } else {
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        }
      }
      await user?.save();
      await redis.set(userId, JSON.stringify(user));
      res.status(201).json({
        success: true,
        message: "Avatar updated successfully",
        user,
      });
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

// Get All users --Only for admin
export const getAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllUsersService(res);
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

//Update user role --Only for admin
interface IUpdateUserRole {
  userId: string;
  role: string;
}

export const updateUserRole = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = req.body as IUpdateUserRole;
      updateUserRoleService(userId, role, res);
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);

//Delete User -- Only for admin
export const deleteUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);
      if (!user) {
        return next(new ErrorHandler(404, "User does not exist"));
      }
      await user.deleteOne({ id });
      await redis.del(id);
      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (Error: any) {
      return next(new ErrorHandler(400, Error.message));
    }
  }
);
