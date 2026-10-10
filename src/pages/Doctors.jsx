import { useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Search, Star, Heart, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import DoctorCard from "@/components/doctors/DoctorCard";
import BookingModal from "@/components/doctors/BookingModal";

const specializations = ["All", "Psychiatrist", "Psychologist", "Therapist", "Counselor", "Life Coach"];

export default function Doctors() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState("All");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => base44.entities.Doctor.list("-rating", 50),
  });

  const createAppointmentMutation = useMutation({
    mutationFn: (data) => base44.entities.Appointment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment booked successfully!");
    },
  });

  const filteredDoctors = doctors.filter((doctor) => {
    const matchesSearch = doctor.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doctor.bio?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialization = selectedSpecialization === "All" ||
                                  doctor.specialization === selectedSpecialization;
    return matchesSearch && matchesSpecialization;
  });

  const handleBook = (doctor, type) => {
    setSelectedDoctor(doctor);
    setIsBookingOpen(true);
  };

  const handleConfirmBooking = async (bookingData) => {
    await createAppointmentMutation.mutateAsync(bookingData);
    setIsBookingOpen(false);
    setSelectedDoctor(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/50 via-white to-purple-50/30">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Home")}>
            <Button variant="ghost" size="icon" className="rounded-full bg-white border border-slate-100 text-slate-500 hover:text-violet-600" style={{ boxShadow: "0 2px 8px -2px rgba(124,58,237,0.06)" }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Find a Doctor</h1>
            <p className="text-sm text-slate-500">Connect with mental health professionals</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctors by name or specialty..."
              className="pl-12 h-12 rounded-2xl border-slate-100 bg-white text-slate-700 placeholder:text-slate-400"
              style={{ boxShadow: "0 2px 12px -3px rgba(124,58,237,0.06)" }}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {specializations.map((spec) => (
              <Button
                key={spec}
                variant={selectedSpecialization === spec ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSpecialization(spec)}
                className={`rounded-full whitespace-nowrap border-0 ${
                  selectedSpecialization === spec
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
                style={selectedSpecialization === spec ? {} : { boxShadow: "0 2px 8px -2px rgba(124,58,237,0.05)" }}
              >
                {spec}
              </Button>
            ))}
          </div>
        </div>

        {/* Doctors List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-white rounded-3xl animate-pulse" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }} />
            ))}
          </div>
        ) : filteredDoctors.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {filteredDoctors.map((doctor, index) => (
              <motion.div
                key={doctor.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <DoctorCard doctor={doctor} onBook={handleBook} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-16">
            <Heart className="w-12 h-12 mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500">No doctors found matching your criteria</p>
            <Button
              variant="link"
              onClick={() => {
                setSearchQuery("");
                setSelectedSpecialization("All");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}

        {/* Empty State - No Doctors */}
        {!isLoading && doctors.length === 0 && (
          <div className="text-center py-16 px-6 bg-white rounded-3xl" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-violet-50 flex items-center justify-center">
              <Star className="w-10 h-10 text-violet-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No Doctors Available Yet</h3>
            <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
              We're working on adding mental health professionals to our platform. Check back soon!
            </p>
          </div>
        )}

        {/* Privacy */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <ShieldCheck className="w-4 h-4 text-slate-300" />
          <p className="text-xs text-slate-400">Your appointment information is private and secure</p>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        doctor={selectedDoctor}
        isOpen={isBookingOpen}
        onClose={() => {
          setIsBookingOpen(false);
          setSelectedDoctor(null);
        }}
        onConfirm={handleConfirmBooking}
      />
    </div>
  );
}