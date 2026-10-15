import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, MessageCircle, History, Users, User, Sparkles, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { icon: Home, label: "Home", page: "Home" },
  { icon: History, label: "History", page: "History" },
  { icon: Users, label: "Doctors", page: "Doctors" },
  { icon: MessageCircle, label: "Chat", page: "Chat" },
  { icon: User, label: "Profile", page: "Settings" },
];

export default function Layout({ children, currentPageName }) {
  const { user, isAuthenticated, openAuthModal } = useAuth();

  return (
    <div className="min-h-screen bg-[#F7F5F0] dark:bg-[#0c1714] text-[#182B2A] dark:text-[#F7F5F0] flex flex-col font-body selection:bg-[#DDE8DF] selection:text-[#245746]">
      {/* Top Header — Compact on mobile, expansive on desktop */}
      <header className="sticky top-0 z-40 bg-[#F7F5F0]/90 dark:bg-[#0c1714]/90 backdrop-blur-md border-b border-[#E9EAE7] dark:border-white/5 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link
            to={createPageUrl("Home")}
            className="flex items-center gap-2.5 focus:outline-none group"
            aria-label="EmoSense AI Home"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-[#245746] dark:bg-[#2f6e59] flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <Sparkles className="w-4 h-4 text-[#DDE8DF]" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-bold text-base sm:text-lg tracking-tight text-[#182B2A] dark:text-white leading-tight">
                EmoSense<span className="text-[#245746] dark:text-[#88c5ad] font-extrabold ml-0.5">AI</span>
              </span>
              <span className="text-[10px] text-[#697681] dark:text-white/50 -mt-0.5 hidden xs:inline">
                Mental Wellness Companion
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-white/70 dark:bg-white/5 p-1 rounded-full border border-[#E9EAE7] dark:border-white/10 text-xs font-medium">
            {navItems.map(({ icon: Icon, label, page }) => {
              const isActive = currentPageName === page || (page === "Home" && (currentPageName === "" || currentPageName === "Home"));
              return (
                <Link
                  key={page}
                  to={createPageUrl(page)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all duration-150",
                    isActive
                      ? "bg-[#245746] text-white shadow-sm font-semibold"
                      : "text-[#697681] hover:text-[#182B2A] dark:text-white/70 dark:hover:text-white hover:bg-[#F7F5F0] dark:hover:bg-white/10"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User profile / Auth button */}
          <div className="flex items-center gap-2">
            {!isAuthenticated ? (
              <button
                onClick={openAuthModal}
                className="h-9 px-3.5 rounded-full bg-[#245746] hover:bg-[#1d4839] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 min-h-[36px]"
              >
                <HeartHandshake className="w-3.5 h-3.5 text-[#DDE8DF]" />
                <span>Sign In</span>
              </button>
            ) : (
              <Link
                to={createPageUrl("Settings")}
                className="flex items-center gap-2 p-1 pl-2.5 rounded-full bg-white dark:bg-white/10 border border-[#E9EAE7] dark:border-white/10 hover:border-[#245746]/30 transition-all text-xs text-[#182B2A] dark:text-white font-medium"
                aria-label="User Profile and Settings"
              >
                <span className="max-w-[100px] sm:max-w-[140px] truncate">
                  {user?.name ? user.name.split(" ")[0] : (user?.email?.split("@")[0] || "Account")}
                </span>
                <div className="w-7 h-7 rounded-full bg-[#DDE8DF] text-[#245746] font-bold text-xs flex items-center justify-center">
                  {(user?.name || user?.email || "U")[0].toUpperCase()}
                </div>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area — safe area padding at bottom on mobile */}
      <main className="flex-1 pb-safe-nav md:pb-12">
        {children}
      </main>

      {/* Mobile Fixed Bottom Navigation — Sticky & Safe Area Aware */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/92 dark:bg-[#121f1b]/95 backdrop-blur-lg border-t border-[#E9EAE7] dark:border-white/10 transition-colors"
        style={{
          boxShadow: "0 -4px 20px -2px rgba(36, 87, 70, 0.06)",
          paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="max-w-md mx-auto grid grid-cols-5 px-1 pt-1.5">
          {navItems.map(({ icon: Icon, label, page }) => {
            const isActive = currentPageName === page || (page === "Home" && (currentPageName === "" || currentPageName === "Home"));
            return (
              <Link
                key={page}
                to={createPageUrl(page)}
                className={cn(
                  "flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-2xl transition-all duration-150 select-none",
                  isActive
                    ? "text-[#245746] dark:text-[#88c5ad]"
                    : "text-[#697681] dark:text-white/50 hover:text-[#182B2A] dark:hover:text-white"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200",
                    isActive ? "bg-[#DDE8DF] dark:bg-white/15 scale-105" : "bg-transparent"
                  )}
                >
                  <Icon className={cn("w-4.5 h-4.5", isActive && "stroke-[2.5px]")} />
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-tight mt-0.5",
                    isActive ? "font-bold text-[#245746] dark:text-[#88c5ad]" : "font-medium"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}