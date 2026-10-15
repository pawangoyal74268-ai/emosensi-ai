// EmoSense AI — Independent Backend Server (Express + Prisma)
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import moodsRouter from "./routes/moods.js";
import analyticsRouter from "./routes/analytics.js";
import doctorsRouter from "./routes/doctors.js";
import appointmentsRouter from "./routes/appointments.js";
import analysisRouter from "./routes/analysis.js";
import chatRouter from "./routes/chat.js";
import memoryRouter from "./routes/memory.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import prisma from "./db.js";
import { seedDatabase } from "./seed.js";

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

// 1. CORS Configuration for Local Development
const allowedOrigins = [
  FRONTEND_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev mode, restrictable in prod
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// 2. Request Body & Cookie Parsing
app.use(cookieParser());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Identify all local Express responses
app.use((req, res, next) => {
  res.setHeader("X-Backend-Service", "EmoSense-Express-Local");
  next();
});

// 3. API Routes
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/moods", moodsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/chat", chatRouter);
app.use("/api/memory", memoryRouter);

// 4. Fallback & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// 5. Server Initialization

async function startServer() {
  try {
    // Verify database connection on startup
    await prisma.$connect();
    console.log("✔ Connected to SQLite database via Prisma ORM.");

    // Auto-seed demonstration doctors if table is empty
    const count = await prisma.doctor.count();
    if (count === 0) {
      console.log("No doctors found in database. Initializing demonstration seed...");
      await seedDatabase();
    }

    const server = app.listen(PORT, () => {
      console.log(`\n==================================================`);
      console.log(`🚀 EmoSense AI Backend running at http://localhost:${PORT}`);
      console.log(`🩺 Health check URL: http://localhost:${PORT}/api/health`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`==================================================\n`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log("Database disconnected. Server stopped.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("Failed to start EmoSense AI Backend:", err);
    process.exit(1);
  }
}

startServer();

export default app;
