import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Workbench" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <div className="border-b border-white/8 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-row items-center justify-between gap-4 px-4 py-2 md:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-sm text-slate-300">
          <div className="mr-3 font-mono text-[11px] tracking-[0.24em] uppercase text-sky-300">
            SkillPeek
          </div>
          {links.map(({ to, label }) => {
            return (
              <Link
                key={to}
                to={to}
                className="border border-transparent px-2.5 py-1.5 transition-colors hover:border-white/8 hover:bg-white/5 hover:text-white"
                activeProps={{
                  className: "border-sky-400/20 bg-sky-400/10 text-sky-100",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
