// Authentication Middleware for EmoSense AI
import jwt from "jsonwebtoken";
import prisma from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "emosense_local_dev_jwt_secret_key_2026";
export const COOKIE_NAME = "emosense_token";

/**
 * Strips sensitive fields (like passwordHash) from user object
 */
export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Generates a signed JWT for a given user
 */
export function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Sets an HTTP-only secure cookie containing the authentication JWT
 */
export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: "/",
  });
}

/**
 * Clears the authentication HTTP-only cookie
 */
export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  });
}

/**
 * Extracts JWT token from either HTTP-only cookie or Bearer Authorization header
 */
function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/**
 * Middleware: Strictly requires valid authentication
 */
export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required. Please log in.",
        },
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Clear invalid cookie if present
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Session expired or invalid. Please log in again.",
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User account no longer exists.",
        },
      });
    }

    req.user = sanitizeUser(user);
    req.userId = user.id;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: Attaches user if token is present, but allows guest access
 */
export async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      req.user = null;
      req.userId = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (user) {
        req.user = sanitizeUser(user);
        req.userId = user.id;
      } else {
        req.user = null;
        req.userId = null;
      }
    } catch {
      req.user = null;
      req.userId = null;
    }

    next();
  } catch (error) {
    next(error);
  }
}
