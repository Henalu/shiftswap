"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GuidedHelpLaunchButton } from "@/components/layout/guided-help-tour";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_NAVIGATION_ITEMS,
  getAdminNavigationItems,
  isNavigationItemActive,
  type NavigationItem,
  PRIMARY_NAVIGATION_ITEMS,
} from "@/components/layout/navigation-items";
import { ChevronDown, Search, X } from "lucide-react";

interface SidebarNavProps {
  role: UserRole;
}

interface SidebarNavContentProps {
  adminItems: NavigationItem[];
  pathname: string;
}

type SidebarSectionId = "work" | "admin" | "account";

type SidebarSectionState = Record<SidebarSectionId, boolean>;

interface SidebarSection {
  id: SidebarSectionId;
  items: NavigationItem[];
  label: string;
}

function hasActiveItem(pathname: string, items: NavigationItem[]) {
  return items.some((item) => isNavigationItemActive(pathname, item.href));
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getNavigationItemSearchValue(item: NavigationItem) {
  return normalizeSearchValue(
    [item.label, item.description, item.href].filter(Boolean).join(" ")
  );
}

export function SidebarNav({ role }: SidebarNavProps) {
  const pathname = usePathname();
  const adminItems = useMemo(() => getAdminNavigationItems(role), [role]);

  return (
    <SidebarNavContent
      adminItems={adminItems}
      key={pathname}
      pathname={pathname}
    />
  );
}

function SidebarNavContent({ adminItems, pathname }: SidebarNavContentProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearchQuery = normalizeSearchValue(searchQuery.trim());
  const hasSearchQuery = normalizedSearchQuery.length > 0;

  const activeSections = useMemo(
    () => ({
      work: hasActiveItem(pathname, PRIMARY_NAVIGATION_ITEMS),
      admin: hasActiveItem(pathname, adminItems),
      account: hasActiveItem(pathname, ACCOUNT_NAVIGATION_ITEMS),
    }),
    [adminItems, pathname]
  );

  const [openSections, setOpenSections] = useState<SidebarSectionState>(() => ({
    work: true,
    admin: activeSections.admin,
    account: activeSections.account,
  }));

  const sections: SidebarSection[] = [
    {
      id: "work",
      label: "Trabajo",
      items: PRIMARY_NAVIGATION_ITEMS,
    },
    ...(adminItems.length > 0
      ? [
          {
            id: "admin" as const,
            label: "Administracion",
            items: adminItems,
          },
        ]
      : []),
    {
      id: "account",
      label: "Cuenta",
      items: ACCOUNT_NAVIGATION_ITEMS,
    },
  ];

  function toggleSection(sectionId: SidebarSectionId) {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const renderItem = ({ href, label, icon: Icon, tour }: NavigationItem) => {
    const isActive = isNavigationItemActive(pathname, href);

    return (
      <Link
        key={href}
        href={href}
        data-tour={tour}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
      >
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            isActive ? "bg-primary/12 text-primary" : "bg-background text-muted-foreground"
          )}
        >
          <Icon className="size-4 shrink-0" />
        </div>
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    );
  };

  const visibleSections = sections.map((section) => ({
    ...section,
    items: hasSearchQuery
      ? section.items.filter((item) =>
          getNavigationItemSearchValue(item).includes(normalizedSearchQuery)
        )
      : section.items,
  }));
  const hasSearchResults = visibleSections.some(
    (section) => section.items.length > 0
  );

  return (
    <nav
      aria-label="Navegacion lateral"
      className="flex h-full flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4"
    >
      <div className="sticky top-0 z-10 bg-sidebar/95 pb-1">
        <div className="group/search relative flex h-11 items-center rounded-2xl border border-border/80 bg-background/85 text-sm shadow-sm transition-[background-color,border-color,box-shadow] focus-within:border-primary/45 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/10">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            aria-label="Buscar en navegacion"
            className="h-full min-w-0 flex-1 rounded-[inherit] bg-transparent py-1 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground/85"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar..."
            ref={searchInputRef}
            type="search"
            value={searchQuery}
          />
          {hasSearchQuery ? (
            <button
              aria-label="Limpiar busqueda"
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/10"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 lg:flex"
            >
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                Ctrl
              </kbd>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                K
              </kbd>
            </span>
          )}
        </div>
      </div>

      {hasSearchQuery && !hasSearchResults ? (
        <p className="rounded-xl px-3 py-2 text-sm text-muted-foreground">
          Sin resultados
        </p>
      ) : null}

      {visibleSections.map((section) => {
        if (hasSearchQuery && section.items.length === 0) {
          return null;
        }

        const isOpen = hasSearchQuery || openSections[section.id];
        const isActiveSection = hasActiveItem(pathname, section.items);
        const contentId = `sidebar-section-${section.id}`;

        return (
          <section className="space-y-1" key={section.id}>
            <button
              aria-controls={contentId}
              aria-expanded={isOpen}
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10",
                isActiveSection ? "text-foreground" : "text-muted-foreground"
              )}
              onClick={() => toggleSection(section.id)}
              type="button"
            >
              <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.12em]">
                {section.label}
              </span>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isOpen || isActiveSection
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform duration-200 motion-reduce:transition-none",
                    isOpen && "rotate-180"
                  )}
                />
              </span>
            </button>

            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
              id={contentId}
            >
              <div className="min-h-0 overflow-hidden">
                {isOpen && (
                  <div className="space-y-1 pb-2">
                    {section.items.map(renderItem)}
                    {section.id === "account" && (
                      <GuidedHelpLaunchButton className="w-full justify-start" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </nav>
  );
}
