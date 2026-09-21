import { asyncHandler } from "../utils/asyncHandler.js"; // Utility to handle async errors without try-catch
import { ApiError } from "../utils/ApiError.js"; // Custom error handler class
import { User } from "../models/user.model.js"; // User model (MongoDB schema)
import { uploadOnCloudinary } from "../utils/cloudnary.js"; // Function to upload files to Cloudinary
import { ApiResponse } from "../utils/ApiResponse.js"; // Standardized API response format
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessTokenAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    //save refresh token in data base
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generateing refere and access token"
    );
  }
};

// Controller function to register a new user
const registerUser = asyncHandler(async (req, res) => {
  // STEP 1: Get user details from frontend request body
  const { username, email, fullName, password } = req.body;

  // STEP 2: Validate - check if any required field is empty
  if (
    [username, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // STEP 3: Check if user already exists (either with same username OR email)
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with same username or email already exists");
  }

  // STEP 4: Extract file paths for avatar and cover image from request (multer stores them in req.files)
  const avatarLocalPath = req.files?.avatar[0]?.path; // Optional chaining prevents errors if file missing
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // STEP 5: Avatar is mandatory → throw error if missing
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // STEP 6: Upload avatar and cover image to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // STEP 7: Avatar upload must succeed, else throw error
  if (!avatar) {
    throw new ApiError(400, "Avatar upload failed");
  }

  // STEP 8: Create new user object in MongoDB
  const user = await User.create({
    fullName: fullName,
    avatar: avatar.url, // Cloudinary returns an object with URL
    coverImage: coverImage?.url || "", // Cover image optional
    email,
    password, // Password will be hashed automatically by mongoose pre-save hook
    username: username.toLowerCase(), // Store username in lowercase for uniqueness
  });

  // STEP 9: Fetch the created user but exclude sensitive fields (password, refreshToken)
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // STEP 10: If user not created properly, throw server error
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // STEP 11: Return success response with created user data
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

//Controller function to login a  user
const loginUser = asyncHandler(async (req, res) => {
  //req body -> data
  //username or email
  //find user
  //password check
  //access and referesh token
  //send cookie

  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(400, "user no found");
  }

  const isPassword = await user.isPasswordCorrect(password);
  if (!isPassword) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefereshTokens(user._id);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const option = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshToken, option)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const option = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(new ApiResponse(200, {}, "User Logout"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorize request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refresh token expaired or used");
    }

    const option = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessTokenAndRefereshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, option)
      .cookie("refreshToken", newRefreshToken, option)
      .json(
        new ApiResponse(
          200,
          { accessToken, newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "password wrong");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "Password changed"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetch successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError(400, "All fields required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Updated Successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avater");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Updated Successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "CoverImage file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on CoverImage");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "CoverImage Updated Successfully"));
});






// Export controller function
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  
};
