// Database Seeding Script for EmoSense AI
// Seeds sample demonstration doctors clearly marked as demo profiles.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sampleDoctors = [
  {
    id: "demo-doc-1",
    name: "Dr. Sarah Jenkins, MD",
    specialization: "Psychiatrist",
    photoUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
    bio: "[Demonstration Profile] Sample licensed psychiatrist specializing in mood regulation and clinical anxiety evaluation. Sample profile for system testing only.",
    experienceYears: 12,
    rating: 4.9,
    consultationFee: 150,
    languages: JSON.stringify(["English", "Spanish"]),
    availableSlots: JSON.stringify(["09:00", "11:00", "14:00", "16:00"]),
    phone: "+1 (555) 019-2831",
    email: "demo.dr.jenkins@example.com",
    isDemoRecord: true,
  },
  {
    id: "demo-doc-2",
    name: "Dr. Marcus Chen, PsyD",
    specialization: "Psychologist",
    photoUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
    bio: "[Demonstration Profile] Sample clinical psychologist focused on cognitive behavioral therapy and mindfulness-based stress reduction.",
    experienceYears: 9,
    rating: 4.8,
    consultationFee: 120,
    languages: JSON.stringify(["English", "Mandarin"]),
    availableSlots: JSON.stringify(["10:00", "13:00", "15:00", "17:00"]),
    phone: "+1 (555) 019-4822",
    email: "demo.dr.chen@example.com",
    isDemoRecord: true,
  },
  {
    id: "demo-doc-3",
    name: "Elena Rostova, LMFT",
    specialization: "Therapist",
    photoUrl: "https://images.unsplash.com/photo-1594824813580-c11f7c3272d5?auto=format&fit=crop&q=80&w=400",
    bio: "[Demonstration Profile] Sample licensed marriage and family therapist supporting emotional resilience, relationship wellness, and burnout recovery.",
    experienceYears: 7,
    rating: 4.7,
    consultationFee: 95,
    languages: JSON.stringify(["English", "Russian"]),
    availableSlots: JSON.stringify(["09:00", "12:00", "15:00"]),
    phone: "+1 (555) 019-7361",
    email: "demo.elena.therapist@example.com",
    isDemoRecord: true,
  },
  {
    id: "demo-doc-4",
    name: "Michael Torres, LPC",
    specialization: "Counselor",
    photoUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
    bio: "[Demonstration Profile] Sample licensed professional counselor offering empathetic guidance on life transitions and stress management.",
    experienceYears: 8,
    rating: 4.8,
    consultationFee: 85,
    languages: JSON.stringify(["English", "Spanish"]),
    availableSlots: JSON.stringify(["11:00", "14:00", "16:00"]),
    phone: "+1 (555) 019-9182",
    email: "demo.michael.counselor@example.com",
    isDemoRecord: true,
  },
  {
    id: "demo-doc-5",
    name: "Maya Patel, ACC",
    specialization: "Life Coach",
    photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400",
    bio: "[Demonstration Profile] Sample certified wellness coach assisting with daily habit building, mindfulness practices, and goal realization.",
    experienceYears: 5,
    rating: 4.6,
    consultationFee: 70,
    languages: JSON.stringify(["English", "Hindi"]),
    availableSlots: JSON.stringify(["10:00", "13:00", "16:00"]),
    phone: "+1 (555) 019-3319",
    email: "demo.maya.coach@example.com",
    isDemoRecord: true,
  },
];

export async function seedDatabase() {
  console.log("Seeding demonstration doctor records...");
  for (const doc of sampleDoctors) {
    await prisma.doctor.upsert({
      where: { id: doc.id },
      update: doc,
      create: doc,
    });
  }
  console.log(`Seeded ${sampleDoctors.length} demonstration doctor profiles.`);
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith("seed.js")) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Seeding error:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
