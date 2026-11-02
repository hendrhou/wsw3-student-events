import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
  icon?: ReactNode;
}

export interface NavbarProps {
  /** UFP logo URL — reference the asset, never recolor or re-host. */
  logoSrc: string;
  appName: string;
  items: NavItem[];
  onNavigate?: (href: string) => void;
  notificationCount?: number;
  userInitials?: string;
  userMenu?: ReactNode;
}

/**
 * Shell navbar (components.md §3): UFP logo + app name, icon+label items,
 * active item gets primary text + 2px underline, right side bell + avatar.
 */
export function Navbar({ logoSrc, appName, items, onNavigate, notificationCount = 0, userInitials, userMenu }: NavbarProps) {
  return (
    <header className="cp-navbar">
      <a
        className="cp-navbar__brand"
        href="/"
        onClick={(e) => {
          if (onNavigate) {
            e.preventDefault();
            onNavigate("/");
          }
        }}
      >
        <img className="cp-navbar__logo" src={logoSrc} alt="Universidade Fernando Pessoa" height={32} />
        <span className="cp-navbar__appname">{appName}</span>
      </a>
      <nav className="cp-navbar__items" aria-label="Primary">
        {items.map((item) => (
          <a
            key={item.href}
            className={cn("cp-navbar__item", item.active && "cp-navbar__item--active")}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate(item.href);
              }
            }}
          >
            {item.icon}
            {item.label}
          </a>
        ))}
      </nav>
      <div className="cp-navbar__right">
        <button type="button" className="cp-navbar__icon-btn" aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {notificationCount > 0 ? <span className="cp-navbar__badge">{notificationCount}</span> : null}
        </button>
        {userMenu ?? (
          <button type="button" className="cp-avatar cp-avatar--32" aria-label="User menu">
            {userInitials ?? "?"}
          </button>
        )}
      </div>
    </header>
  );
}
