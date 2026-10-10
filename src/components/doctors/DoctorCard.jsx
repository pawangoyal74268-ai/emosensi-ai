import { motion } from "framer-motion";
import { Star, Clock, Languages, Video, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const specializationColors = {
  Psychiatrist: "bg-violet-100 text-violet-700",
  Psychologist: "bg-blue-100 text-blue-700",
  Therapist: "bg-teal-100 text-teal-700",
  Counselor: "bg-amber-100 text-amber-700",
  "Life Coach": "bg-rose-100 text-rose-700",
};

export default function DoctorCard({ doctor, onBook, compact = false }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={cn(
        "bg-white rounded-3xl border border-slate-100 overflow-hidden transition-all duration-300",
        compact ? "p-4" : "p-6"
      )}
      style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}
    >
      <div className="flex gap-4">
        {/* Photo */}
        <div className={cn(
          "relative flex-shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50",
          compact ? "w-16 h-16" : "w-24 h-24"
        )}>
          {doctor.photo_url ? (
            <img
              src={doctor.photo_url}
              alt={doctor.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-slate-300 font-semibold">
              {doctor.name?.charAt(0)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className={cn("font-semibold text-slate-800", compact ? "text-base" : "text-lg")}>
                  {doctor.name}
                </h3>
                <BadgeCheck className="w-4 h-4 text-violet-500 flex-shrink-0" />
              </div>
              <Badge className={cn("mt-1.5 border-0 font-medium", specializationColors[doctor.specialization] || "bg-slate-100 text-slate-700")}>
                {doctor.specialization}
              </Badge>
            </div>

            {doctor.rating && (
              <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span className="text-sm font-semibold text-amber-700">{doctor.rating}</span>
              </div>
            )}
          </div>

          {!compact && (
            <>
              {doctor.bio && (
                <p className="mt-3 text-sm text-slate-500 line-clamp-2 leading-relaxed">{doctor.bio}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                {doctor.experience_years && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {doctor.experience_years} years exp.
                  </span>
                )}
                {doctor.languages?.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5" />
                    {doctor.languages.join(", ")}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Consultation Fee</p>
            <p className="text-lg font-bold text-slate-800">
              ${doctor.consultation_fee || 0}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => onBook(doctor, "video")}
            >
              <Video className="w-4 h-4 mr-1.5" />
              Video
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 border-0"
              onClick={() => onBook(doctor)}
            >
              Book Now
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}