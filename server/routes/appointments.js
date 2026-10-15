// Appointment Booking and Management Routes for EmoSense AI
import express from "express";
import { z } from "zod";
import prisma from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { formatDoctor } from "./doctors.js";

const router = express.Router();

/**
 * Formats an Appointment record for complete cross-stack frontend compatibility
 */
export function formatAppointment(apt) {
  if (!apt) return null;
  return {
    id: apt.id,
    userId: apt.userId,
    doctorId: apt.doctorId,
    doctor_id: apt.doctorId,
    doctorName: apt.doctorName,
    doctor_name: apt.doctorName,
    date: apt.date,
    time: apt.time,
    status: apt.status,
    consultationType: apt.consultationType,
    type: apt.consultationType, // Used by BookingModal and Home.jsx
    notes: apt.notes || "",
    createdAt: apt.createdAt,
    created_date: apt.createdAt,
    updatedAt: apt.updatedAt,
    doctor: apt.doctor ? formatDoctor(apt.doctor) : null,
  };
}

const appointmentCreateSchema = z.object({
  doctorId: z.string().trim().min(1).optional(),
  doctor_id: z.string().trim().min(1).optional(),
  doctorName: z.string().trim().min(1).optional(),
  doctor_name: z.string().trim().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  consultationType: z.enum(["video", "phone", "in-person"]).optional(),
  type: z.enum(["video", "phone", "in-person"]).optional(),
  notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
}).refine((data) => data.doctorId || data.doctor_id, {
  message: "Doctor ID is required",
  path: ["doctorId"],
});

const appointmentUpdateSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format").optional(),
  consultationType: z.enum(["video", "phone", "in-person"]).optional(),
  type: z.enum(["video", "phone", "in-person"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

/**
 * POST /api/appointments
 * Creates a new appointment for the authenticated user.
 */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const validated = appointmentCreateSchema.parse(req.body);

    const doctorId = (validated.doctorId || validated.doctor_id).trim();
    const consultationType = validated.consultationType || validated.type || "video";
    let doctorName = validated.doctorName || validated.doctor_name;

    // Verify doctor exists in database
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: {
          code: "DOCTOR_NOT_FOUND",
          message: "The specified doctor does not exist.",
        },
      });
    }

    if (!doctorName) {
      doctorName = doctor.name;
    }

    const appointment = await prisma.appointment.create({
      data: {
        userId: req.userId,
        doctorId,
        doctorName,
        date: validated.date,
        time: validated.time,
        consultationType,
        status: "scheduled",
        notes: validated.notes?.trim() || null,
      },
      include: {
        doctor: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      appointment: formatAppointment(appointment),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/appointments
 * Retrieves only the authenticated user's scheduled or past appointments.
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status, limit = 50 } = req.query;

    const where = {
      userId: req.userId, // Strictly scopes query to authenticated user
    };

    if (status) {
      where.status = status;
    }

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: parsedLimit,
      include: {
        doctor: true,
      },
    });

    const formatted = appointments.map(formatAppointment);

    res.json({
      success: true,
      count: formatted.length,
      appointments: formatted,
      data: formatted, // Alias for query conveniences
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/appointments/:id
 * Retrieves a single appointment, strictly verifying ownership.
 */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: true },
    });

    if (!appointment || appointment.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Appointment not found.",
        },
      });
    }

    res.json({
      success: true,
      appointment: formatAppointment(appointment),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/appointments/:id
 * Updates appointment details or status (e.g. cancellation), strictly verifying ownership.
 */
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const validated = appointmentUpdateSchema.parse(req.body);

    const existing = await prisma.appointment.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Appointment not found or you lack permission to update it.",
        },
      });
    }

    const updateData = {};
    if (validated.status) updateData.status = validated.status;
    if (validated.date) updateData.date = validated.date;
    if (validated.time) updateData.time = validated.time;
    if (validated.consultationType || validated.type) {
      updateData.consultationType = validated.consultationType || validated.type;
    }
    if (validated.notes !== undefined) updateData.notes = validated.notes;

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: updateData,
      include: { doctor: true },
    });

    res.json({
      success: true,
      message: "Appointment updated successfully.",
      appointment: formatAppointment(updated),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/appointments/:id
 * Cancels or removes an appointment, strictly verifying ownership.
 */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.appointment.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Appointment not found.",
        },
      });
    }

    await prisma.appointment.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: "Appointment cancelled and removed.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
