import multer from "multer";

// 1. Storage configuration
const storage = multer.diskStorage({
  // Where to store uploaded files
  destination: function (req, file, cb) {
    cb(null, "./public/temp");  
    // "./public/temp" is a folder inside your project 
    // where uploaded files will be saved temporarily
  },

  // How to name uploaded files
  filename: function (req, file, cb) {
    cb(null, file.originalname);
    // file.originalname = original name of the uploaded file
    // Example: if you upload "photo.jpg", it will be saved as "photo.jpg"
  },
});

// 2. Create multer upload middleware
export const upload = multer({
  storage,
});
