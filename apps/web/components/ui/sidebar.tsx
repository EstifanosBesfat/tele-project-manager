"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

/* ------------------------------------------------------------------ */
/* Context                                                              */
/* ------------------------------------------------------------------ */

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  isMobile: boolean
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider")
  return ctx
}

/* ------------------------------------------------------------------ */
/* Provider                                                             */
/* ------------------------------------------------------------------ */

export function SidebarProvider({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [open, setOpen] = React.useState(true)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
      if (e.matches) setOpen(false)
    }
    handler(mq)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <SidebarContext.Provider value={{ open, setOpen, isMobile }}>
      <div
        data-slot="sidebar-provider"
        className={cn("flex h-svh w-full overflow-hidden", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar shell                                                        */
/* ------------------------------------------------------------------ */

export function Sidebar({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen, isMobile } = useSidebar()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[260px] p-0 flex flex-col">
          <SheetTitle className="sr-only">Navigation Sidebar</SheetTitle>
          <aside
            data-slot="sidebar"
            className={cn(
              "flex flex-1 h-full w-full flex-col bg-sidebar text-sidebar-foreground",
              className
            )}
            {...props}
          >
            {children}
          </aside>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      data-slot="sidebar"
      data-state={open ? "expanded" : "collapsed"}
      className={cn(
        "group/sidebar sticky top-0 flex h-svh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
        open ? "w-64" : "w-14",
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-sections                                                         */
/* ------------------------------------------------------------------ */

export function SidebarHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex items-center border-b px-3 py-3", className)}
      {...props}
    />
  )
}

export function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex flex-1 flex-col gap-1 overflow-y-auto p-2", className)}
      {...props}
    />
  )
}

export function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex items-center border-t p-3", className)}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Rail (collapse toggle strip)                                         */
/* ------------------------------------------------------------------ */

export function SidebarRail({ className, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = useSidebar()
  return (
    <button
      data-slot="sidebar-rail"
      aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
      title={open ? "Collapse sidebar" : "Expand sidebar"}
      onClick={() => setOpen(!open)}
      className={cn(
        "absolute -right-3 top-6 z-20 flex h-6 w-6 items-center justify-center rounded-full border bg-sidebar shadow-sm transition-transform hover:bg-sidebar-accent",
        className,
      )}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("transition-transform", open ? "rotate-0" : "rotate-180")}
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Inset (the main content area beside the sidebar)                    */
/* ------------------------------------------------------------------ */

export function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sidebar-inset"
      className={cn("flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Trigger (hamburger button shown inside the inset)                   */
/* ------------------------------------------------------------------ */

export function SidebarTrigger({ className, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = useSidebar()
  return (
    <button
      data-slot="sidebar-trigger"
      aria-label="Toggle sidebar"
      onClick={() => setOpen(!open)}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors",
        className,
      )}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Menu primitives                                                      */
/* ------------------------------------------------------------------ */

export function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  )
}

export function SidebarMenuItem({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  )
}

export function SidebarMenuButton({
  isActive,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLButtonElement> & { isActive?: boolean }) {
  const { open } = useSidebar()
  return (
    <button
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary font-semibold"
          : "text-sidebar-foreground",
        !open && "justify-center px-0",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <span
      data-slot="sidebar-menu-label"
      className={cn("truncate", className)}
      {...props}
    />
  )
}
