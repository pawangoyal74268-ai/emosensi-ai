// Authentication Routes for EmoSense AI
import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../db.js";
import {
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  sanitizeUser,
  requireAuth,
} from "../middleware/auth.js";

const router = express.Router();

// Validation Schemas
const registerSchema = z.object({
  email: z.string().email("Please provide a valid email address").toLowerCase().trim(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  name: z.string().trim().min(1, "Name cannot be empty").max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Please provide a valid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "New password must be at least 6 characters long").optional(),
});

/**
 * POST /api/auth/register
 * Creates a new user account with hashed password and sets HTTP-only auth cookie.
 */
router.post("/register", async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, name } = validatedData;

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: "EMAIL_EXISTS",
          message: "An account with this email address already exists.",
        },
      });
    }

    // Secure password hashing
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const displayName = name || email.split("@")[0];

    const newUser = await prisma.user.create({
      data: {
        email,
        name: displayName,
        passwordHash,
      },
    });

    const safeUser = sanitizeUser(newUser);
    const token = generateToken(newUser);

    // Set HTTP-only cookie
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: safeUser,
      token, // Also provided in JSON for clients preferring Bearer Authorization headers
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Validates credentials and sets HTTP-only auth cookie.
 */
router.post("/login", async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
    }

    const safeUser = sanitizeUser(user);
    const token = generateToken(user);

    // Set HTTP-only cookie
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: "Logged in successfully.",
      user: safeUser,
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/demo-login
 * Developer convenience helper for instantaneous local testing.
 */
router.post("/demo-login", async (req, res, next) => {
  try {
    const demoEmail = "demo.user@emosense.ai";
    let user = await prisma.user.findUnique({
      where: { email: demoEmail },
    });

    if (!user) {
      const defaultPasswordHash = await bcrypt.hash("Demo123!", 10);
      user = await prisma.user.create({
        data: {
          email: demoEmail,
          name: "Demo Explorer",
          passwordHash: defaultPasswordHash,
        },
      });
    }

    const safeUser = sanitizeUser(user);
    const token = generateToken(user);

    setAuthCookie(res, token);

    res.json({
      success: true,
      message: "Logged in as Demo Explorer.",
      user: safeUser,
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user profile.
 */
router.get("/me", requireAuth, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * PUT /api/auth/profile
 * Updates the user's display name or password.
 */
router.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const validatedData = profileUpdateSchema.parse(req.body);
    const { name, currentPassword, newPassword } = validatedData;

    const dbUser = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!dbUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found.",
        },
      });
    }

    const updateData = {};
    if (name) {
      updateData.name = name;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: "CURRENT_PASSWORD_REQUIRED",
            message: "Current password is required to set a new password.",
          },
        });
      }

      if (dbUser.passwordHash) {
        const isMatch = await bcrypt.compare(currentPassword, dbUser.passwordHash);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            error: {
              code: "INVALID_CURRENT_PASSWORD",
              message: "Current password does not match.",
            },
          });
        }
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
    });

    res.json({
      success: true,
      message: "Profile updated successfully.",
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Clears HTTP-only authentication cookie and terminates session.
 */
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

export default router;
