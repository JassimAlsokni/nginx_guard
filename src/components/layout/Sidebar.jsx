import { Link, useLocation } from "react-router-dom";
import { Shield, Home, Zap, Lock, FileText, Settings, Terminal, Menu, X, FileClock } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navGroups = [
  {
    title: "Main",
    items: [{ path: "/", label: "Dashboard", icon: Home }],
  },
  {
    title: "Attack Lab",
    items: [
      { path: "/attack-simulator", label: "Attack Simulator", icon: Zap },
      { path: "/config-generator", label: "Config Generator", icon: Settings },
      { path: "/logs", label: "Nginx Logs", icon: FileClock },
    ],
  },
  {
    title: "Learn",
    items: [
      { path: "/security-headers", label: "Security Headers", icon: Shield },
      { path: "/ssl-tls-guide", label: "SSL / TLS Guide", icon: Lock },
      { path: "/nginx-docs", label: "Nginx Reference", icon: FileText },
      { path: "/command-tests", label: "Test Commands", icon: Terminal },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <Link to="/" className="flex items-center gap-3 px-5 py-6 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <span className="font-bold text-foreground text-base tracking-tight">Secure Proxy Lab</span>
          <span className="block text-[10px] text-muted-foreground font-mono tracking-wider uppercase">EC520</span>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <div className="px-3 py-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">EC520</span> Secure Proxy Lab
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border z-30">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm">Secure Proxy Lab</span>
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground p-1">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-30 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border"
            >
              <NavContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
