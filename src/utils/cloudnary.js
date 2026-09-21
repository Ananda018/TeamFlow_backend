import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //uplod file in cloud
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    //file uplod successfull
    console.log("file upload in cloud", response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); //remove the local saved temporary file as the upload operation got failed
    return null;
  }
};

export {uploadOnCloudinary}
