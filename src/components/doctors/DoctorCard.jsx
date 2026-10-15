import { Star, Clock, Languages, Video, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const specializationStyles = {
  Psychiatrist: "bg-[#EEE8FA] text-[#553385] dark:bg-[#322349] dark:text-[#c4a6fb]",
  Psychologist: "bg-[#E4EDFC] text-[#284f88] dark:bg-[#1a2c49] dark:text-[#a0c2f8]",
  Therapist: "bg-[#DDE8DF] text-[#245746] dark:bg-[#1a382e] dark:text-[#88c5ad]",
  Counselor: "bg-[#F7F5F0] text-[#182B2A] dark:bg-white/10 dark:text-white",
  "Life Coach": "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
};

export default function DoctorCard({ doctor, onBook, compact = false }) {
  return (
    <div
      className={cn(
        "card-wellness overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        compact ? "p-4" : "p-5 sm:p-6"
      )}
    >
      <div className="flex gap-4">
        {/* Photo or Initials */}
        <div
          className={cn(
            "relative flex-shrink-0 rounded-2xl overflow-hidden bg-[#F7F5F0] dark:bg-white/5 border border-[#E9EAE7] dark:border-white/10",
            compact ? "w-14 h-14" : "w-20 h-20 sm:w-24 sm:h-24"
          )}
        >
          {doctor.photo_url ? (
            <img
              src={doctor.photo_url}
              alt={doctor.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-[#245746] dark:text-[#88c5ad]">
              {doctor.name?.charAt(0)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className={cn("font-heading font-bold text-[#182B2A] dark:text-white", compact ? "text-sm" : "text-base sm:text-lg")}>
                  {doctor.name}
                </h3>
                <BadgeCheck className="w-4 h-4 text-[#245746] dark:text-[#88c5ad] flex-shrink-0" />
              </div>
              <span
                className={cn(
                  "inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                  specializationStyles[doctor.specialization] || "bg-[#F7F5F0] text-[#182B2A]"
                )}
              >
                {doctor.specialization}
              </span>
            </div>

            {doctor.rating && (
              <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 px-2 py-0.5 rounded-full">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span className="text-xs font-bold text-amber-800 dark:text-amber-200">{doctor.rating}</span>
              </div>
            )}
          </div>

          {!compact && (
            <>
              {doctor.bio && (
                <p className="mt-2 text-xs sm:text-sm text-[#697681] dark:text-white/70 line-clamp-2 leading-relaxed">
                  {doctor.bio}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#697681] dark:text-white/60">
                {doctor.experience_years && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#245746] dark:text-[#88c5ad]" />
                    {doctor.experience_years} yrs experience
                  </span>
                )}
                {doctor.languages?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Languages className="w-3 h-3 text-[#245746] dark:text-[#88c5ad]" />
                    {doctor.languages.join(", ")}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-4 pt-3.5 border-t border-[#E9EAE7] dark:border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#697681] dark:text-white/50 uppercase tracking-wider font-semibold">
              Consultation Fee
            </p>
            <p className="text-base sm:text-lg font-heading font-extrabold text-[#182B2A] dark:text-white">
              ${doctor.consultation_fee || 0}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white hover:bg-[#F7F5F0] dark:hover:bg-white/10 text-xs font-semibold h-10 px-3.5"
              onClick={() => onBook(doctor, "video")}
            >
              <Video className="w-3.5 h-3.5 mr-1 text-[#245746] dark:text-[#88c5ad]" />
              Video
            </Button>
            <Button
              size="sm"
              className="rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white text-xs font-bold h-10 px-4"
              onClick={() => onBook(doctor)}
            >
              Book Session
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}