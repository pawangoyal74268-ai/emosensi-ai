import { useState } from "react";
import apiClient, { ApiError } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Search, ShieldCheck, LogIn, Users } from "lucide-react";
import { toast } from "sonner";
import DoctorCard from "@/components/doctors/DoctorCard";
import BookingModal from "@/components/doctors/BookingModal";
import { cn } from "@/lib/utils";

const specializations = ["All", "Psychiatrist", "Psychologist", "Therapist", "Counselor", "Life Coach"];

export default function Doctors() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState("All");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      try {
        const res = await apiClient.doctors.list();
        return res.doctors || res.data || [];
      } catch (err) {
        console.warn("[Doctors] Doctor directory fetch notice:", err.message);
        return [];
      }
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: /** @param {import('@/types').AppointmentCreateInput} data */ async (data) => {
      if (!isAuthenticated) {
        throw new ApiError("Please sign in to book an appointment with a professional.", 401);
      }
      return await apiClient.appointments.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment booked successfully!");
    },
    onError: (err) => {
      const appErr = /** @type {import('@/types').AppError} */ (err);
      if (appErr?.status === 401) {
        toast.error("Please sign in to book an appointment.");
        openAuthModal();
      } else {
        toast.error(appErr?.message || "Failed to book appointment.");
      }
    },
  });

  const filteredDoctors = doctors.filter((doctor) => {
    const matchesSearch =
      doctor.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.bio?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialization =
      selectedSpecialization === "All" ||
      doctor.specialization === selectedSpecialization;
    return matchesSearch && matchesSpecialization;
  });

  const handleBook = (doctor, _type) => {
    setSelectedDoctor(doctor);
    setIsBookingOpen(true);
  };

  const handleConfirmBooking = async (bookingData) => {
    await createAppointmentMutation.mutateAsync(bookingData);
    setIsBookingOpen(false);
    setSelectedDoctor(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <Link to={createPageUrl("Home")}>
          <button
            className="w-10 h-10 rounded-2xl bg-white dark:bg-white/10 border border-[#E9EAE7] dark:border-white/10 flex items-center justify-center text-[#182B2A] dark:text-white hover:border-[#245746]/40 transition-colors shadow-sm active:scale-95"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-[#182B2A] dark:text-white">
            Find a Therapist
          </h1>
          <p className="text-xs sm:text-sm text-[#697681] dark:text-white/60">
            Connect with certified psychologists, psychiatrists, and wellness counselors
          </p>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="p-4 rounded-2xl bg-[#DDE8DF]/70 dark:bg-[#1a2e26] border border-[#DDE8DF] dark:border-white/10 flex items-center justify-between gap-3 text-[#182B2A] dark:text-white text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            <LogIn className="w-4 h-4 text-[#245746] dark:text-[#88c5ad] flex-shrink-0" />
            <span>Sign in to book private consultation sessions and sync appointments.</span>
          </div>
          <button
            onClick={openAuthModal}
            className="px-3 py-1.5 rounded-xl bg-[#245746] text-white text-xs font-semibold flex-shrink-0 active:scale-95"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Search & Specialty Filter Controls */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#697681]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search doctors by name, specialty, or focus area..."
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white dark:bg-[#14231f] border border-[#E9EAE7] dark:border-white/10 text-xs sm:text-sm text-[#182B2A] dark:text-white placeholder:text-[#697681]/60 focus:outline-none focus:border-[#245746] shadow-xs"
          />
        </div>

        {/* Horizontal specialty pill filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {specializations.map((spec) => {
            const isSelected = selectedSpecialization === spec;
            return (
              <button
                key={spec}
                onClick={() => setSelectedSpecialization(spec)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 min-h-[36px]",
                  isSelected
                    ? "bg-[#245746] text-white shadow-xs"
                    : "bg-white dark:bg-white/10 text-[#697681] dark:text-white/70 border border-[#E9EAE7] dark:border-white/10 hover:border-[#245746]/30"
                )}
              >
                {spec}
              </button>
            );
          })}
        </div>
      </div>

      {/* Doctor Cards List */}
      <div className="space-y-3.5">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#697681]">Loading specialists...</div>
        ) : filteredDoctors.length > 0 ? (
          filteredDoctors.map((doctor) => (
            <DoctorCard
              key={doctor.id}
              doctor={doctor}
              onBook={handleBook}
            />
          ))
        ) : (
          <div className="card-wellness p-8 text-center space-y-2">
            <Users className="w-8 h-8 mx-auto text-[#697681]/40" />
            <h3 className="text-sm font-bold text-[#182B2A] dark:text-white">No doctors matched your filter</h3>
            <p className="text-xs text-[#697681] dark:text-white/60">
              Try adjusting your search terms or selecting "All" specializations.
            </p>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedDoctor && (
        <BookingModal
          doctor={selectedDoctor}
          isOpen={isBookingOpen}
          onClose={() => setIsBookingOpen(false)}
          onConfirm={handleConfirmBooking}
        />
      )}

      {/* Safety Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#697681] dark:text-white/40 pt-2">
        <ShieldCheck className="w-4 h-4 text-[#245746] dark:text-[#88c5ad]" />
        <span>Licensed healthcare professionals verified under EmoSense AI clinical network</span>
      </div>
    </div>
  );
}