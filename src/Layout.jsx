import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, MessageCircle, History, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", page: "Home" },
  { icon: MessageCircle, label: "Chat", page: "Chat" },
  { icon: History, label: "History", page: "History" },
  { icon: Users, label: "Doctors", page: "Doctors" },
];

export default function Layout({ children, currentPageName }) {
  const hideNav = ["Chat"].includes(currentPageName);

  return (
    <div className="min-h-screen bg-background">
      {children}

      {/* Bottom Navigation */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/85 backdrop-blur-xl border-t border-slate-100 px-4 z-50" style={{ boxShadow: "0 -2px 20px -5px rgba(124,58,237,0.06)" }}>
          <div className="max-w-lg mx-auto flex items-center justify-around py-2.5">
            {navItems.map(({ icon: Icon, label, page }) => {
              const isActive = currentPageName === page;
              return (
                <Link
                  key={page}
                  to={createPageUrl(page)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-5 py-1.5 rounded-2xl transition-all duration-200",
                    isActive ? "text-primary" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-xl transition-all duration-200",
                    isActive && "bg-accent"
                  )}>
                    <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                  </div>
                  <span className={cn("text-[11px] font-medium", isActive && "font-semibold")}>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {!hideNav && <div className="h-20" />}
    </div>
  );
}