import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, Video, Phone, MapPin, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

const timeSlots = [
  "09:00", "10:00", "11:00", "12:00",
  "14:00", "15:00", "16:00", "17:00"
];

export default function BookingModal({ doctor, isOpen, onClose, onConfirm }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedType, setSelectedType] = useState("video");
  const [notes, setNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i + 1));

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;

    setIsBooking(true);
    await onConfirm({
      doctor_id: doctor.id,
      doctor_name: doctor.name,
      date: format(selectedDate, "yyyy-MM-dd"),
      time: selectedTime,
      type: selectedType,
      notes,
    });
    setIsBooking(false);
    onClose();
  };

  if (!isOpen || !doctor) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white dark:bg-[#14231f] rounded-3xl overflow-hidden shadow-2xl border border-[#E9EAE7] dark:border-white/10"
        >
          {/* Header */}
          <div className="relative p-5 sm:p-6 bg-gradient-to-r from-[#245746] to-[#1a3e32] text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/15 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {doctor.photo_url ? (
                  <img src={doctor.photo_url} alt={doctor.name} className="w-full h-full object-cover" />
                ) : (
                  doctor.name?.charAt(0)
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-lg font-heading font-bold">{doctor.name}</h3>
                  <BadgeCheck className="w-4 h-4 text-[#DDE8DF]" />
                </div>
                <p className="text-xs text-[#DDE8DF]">{doctor.specialization}</p>
                <p className="text-xs text-white/80 mt-1 font-mono font-bold">${doctor.consultation_fee || 0} / session</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Consultation Type */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-2.5">
                Consultation Type
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: "video", icon: Video, label: "Video Call" },
                  { type: "phone", icon: Phone, label: "Audio Call" },
                  { type: "in-person", icon: MapPin, label: "In Person" },
                ].map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-xs font-semibold min-h-[56px]",
                      selectedType === type
                        ? "border-[#245746] bg-[#DDE8DF]/50 text-[#245746] dark:bg-white/15 dark:text-white dark:border-white"
                        : "border-[#E9EAE7] dark:border-white/10 hover:border-[#245746]/30 text-[#697681] dark:text-white/70"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px]">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selection */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-2.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#245746] dark:text-[#88c5ad]" />
                Select Date
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {dates.map((date) => {
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        "flex-shrink-0 flex flex-col items-center p-2.5 rounded-2xl border transition-all min-w-[62px] min-h-[64px]",
                        isSelected
                          ? "border-[#245746] bg-[#245746] text-white"
                          : "border-[#E9EAE7] dark:border-white/10 text-[#697681] dark:text-white/70 hover:border-[#245746]/30 bg-[#F7F5F0]/60 dark:bg-white/5"
                      )}
                    >
                      <span className="text-[10px] uppercase font-bold">{format(date, "EEE")}</span>
                      <span className="text-base font-heading font-extrabold my-0.5">{format(date, "d")}</span>
                      <span className="text-[10px]">{format(date, "MMM")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Selection */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-2.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#245746] dark:text-[#88c5ad]" />
                Available Time Slots
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((time) => {
                  const isSelected = selectedTime === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={cn(
                        "py-2 px-1 rounded-xl border text-xs font-mono font-bold transition-all min-h-[38px]",
                        isSelected
                          ? "border-[#245746] bg-[#245746] text-white"
                          : "border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white/80 hover:border-[#245746]/30 bg-[#F7F5F0]/60 dark:bg-white/5"
                      )}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <label htmlFor="booking-notes" className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60">
                Topics or Notes for the Doctor (Optional)
              </label>
              <Textarea
                id="booking-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 300))}
                placeholder="Share any specific goals, anxiety patterns, or questions you wish to discuss..."
                rows={3}
                className="w-full rounded-2xl border-[#E9EAE7] dark:border-white/10 bg-[#F7F5F0]/60 dark:bg-black/20 text-xs sm:text-sm text-[#182B2A] dark:text-white p-3 resize-none"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-[#E9EAE7] dark:border-white/10 flex items-center justify-between gap-3 bg-[#F7F5F0]/40 dark:bg-black/20">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-2xl border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white text-xs font-semibold h-11 px-5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedDate || !selectedTime || isBooking}
              className="rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white text-xs font-bold h-11 px-6 shadow-sm disabled:opacity-40"
            >
              {isBooking ? "Confirming..." : "Confirm Booking"}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}