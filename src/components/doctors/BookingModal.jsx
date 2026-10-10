import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, Video, Phone, MapPin, Check, BadgeCheck } from "lucide-react";
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white rounded-3xl overflow-hidden"
          style={{ boxShadow: "0 20px 60px -10px rgba(124,58,237,0.15)" }}
        >
          {/* Header */}
          <div className="relative p-6 bg-gradient-to-r from-violet-500 to-purple-600">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/20">
                {doctor.photo_url ? (
                  <img src={doctor.photo_url} alt={doctor.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-white font-semibold">
                    {doctor.name?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="text-white">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xl font-semibold">{doctor.name}</h3>
                  <BadgeCheck className="w-5 h-5 text-white/80" />
                </div>
                <p className="text-white/80 text-sm mt-0.5">{doctor.specialization}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Consultation Type */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Consultation Type</h4>
              <div className="flex gap-3">
                {[
                  { type: "video", icon: Video, label: "Video Call" },
                  { type: "phone", icon: Phone, label: "Phone Call" },
                  { type: "in-person", icon: MapPin, label: "In Person" },
                ].map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                      selectedType === type
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-100 hover:border-slate-200 text-slate-500"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selection */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-500" />
                Select Date
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((date) => (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "flex-shrink-0 flex flex-col items-center p-3 rounded-2xl border-2 transition-all min-w-[68px]",
                      selectedDate?.toDateString() === date.toDateString()
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-100 hover:border-slate-200 text-slate-500"
                    )}
                  >
                    <span className="text-xs">{format(date, "EEE")}</span>
                    <span className="text-lg font-bold mt-0.5">{format(date, "d")}</span>
                    <span className="text-xs">{format(date, "MMM")}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selection */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-500" />
                Select Time
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={cn(
                      "p-3 rounded-2xl border-2 text-sm font-medium transition-all",
                      selectedTime === time
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-100 hover:border-slate-200 text-slate-500"
                    )}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Additional Notes (Optional)</h4>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe your concerns or what you'd like to discuss..."
                className="resize-none rounded-2xl border-slate-100 focus:border-violet-300"
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-sm">Consultation Fee</span>
              <span className="text-xl font-bold text-slate-800">${doctor.consultation_fee || 0}</span>
            </div>
            <Button
              onClick={handleConfirm}
              disabled={!selectedDate || !selectedTime || isBooking}
              className="w-full rounded-2xl h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 border-0"
            >
              {isBooking ? (
                "Booking..."
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Confirm Booking
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}