// Centralized Error Handling Middleware for EmoSense AI
import { ZodError } from "zod";

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    },
  });
}

export function errorHandler(err, req, res, next) {
  console.error(`[Server Error] ${req.method} ${req.url}:`, err);

  // Zod Input Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      },
    });
  }

  // Prisma Known Request Error
  if (err.code && typeof err.code === "string" && err.code.startsWith("P")) {
    return res.status(400).json({
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "A database constraint or operation error occurred",
      },
    });
  }

  // Syntax / Bad JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON payload",
      },
    });
  }

  // Generic / Unexpected Error
  const statusCode = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV === "development";

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message: err.message || "An unexpected server error occurred",
      ...(isDev && err.stack ? { stack: err.stack } : {}),
    },
  });
}
