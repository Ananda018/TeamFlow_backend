import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
// Middleware for enabling CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", //use for which websit you allowed to connect to your backend
    credentials: true,
  })
);
// Middleware for parsing JSON requests
app.use(
  express.json({
    limit: "16kb",
  })
);
// Middleware for parsing URL-encoded requests
app.use(
  express.urlencoded({
    limit: "16kb",
    extended: true,
  })
);

// Middleware for serving static files
app.use(express.static("public"));
app.use(cookieParser());

//routes import
import userRouter from "./routes/user.routes.js"




//routes declaration
app.use("/api/v1/users",userRouter)

export { app };
