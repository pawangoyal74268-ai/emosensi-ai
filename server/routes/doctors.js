// Doctor Directory Routes for EmoSense AI
import express from "express";
import prisma from "../db.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();

function safeJsonParseArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [val];
  } catch {
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

/**
 * Formats doctor record for full frontend compatibility with both camelCase and snake_case
 */
export function formatDoctor(doc) {
  if (!doc) return null;
  const parsedLanguages = safeJsonParseArray(doc.languages);
  const parsedSlots = safeJsonParseArray(doc.availableSlots);

  return {
    id: doc.id,
    name: doc.name,
    specialization: doc.specialization,
    photoUrl: doc.photoUrl,
    photo_url: doc.photoUrl,
    bio: doc.bio,
    experienceYears: doc.experienceYears,
    experience_years: doc.experienceYears,
    rating: doc.rating,
    consultationFee: doc.consultationFee,
    consultation_fee: doc.consultationFee,
    languages: parsedLanguages,
    availableSlots: parsedSlots,
    available_slots: parsedSlots,
    phone: doc.phone,
    email: doc.email,
    isDemoRecord: doc.isDemoRecord,
    is_demo_record: doc.isDemoRecord,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * GET /api/doctors
 * Returns mental health professionals directory with optional filtering and search.
 */
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const { specialization, search } = req.query;

    const where = {};

    if (specialization && specialization !== "All") {
      where.specialization = specialization;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { bio: { contains: q } },
      ];
    }

    const doctors = await prisma.doctor.findMany({
      where,
      orderBy: { rating: "desc" },
    });

    const formattedDoctors = doctors.map(formatDoctor);

    res.json({
      success: true,
      count: formattedDoctors.length,
      doctors: formattedDoctors,
      data: formattedDoctors, // Alias for query compatibility
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/doctors/:id
 * Returns a single doctor by ID.
 */
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Doctor profile not found.",
        },
      });
    }

    res.json({
      success: true,
      doctor: formatDoctor(doctor),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
