import { cn } from "cn";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
type NavItem = {
  label: string;
  href: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

type SidebarData = {
  navGroups: NavGroup[];
  // footerGroup: NavGroup;
};

const sidebarData: SidebarData = {
  navGroups: [
    {
      title: "Settings",
      items: [
        {
          label: "Profile",
          href: "/settings/profile",
        },
        {
          label: "Hamsters",
          // icon: ClipboardList,
          href: "/settings/hamsterprofile"
        },
        {
          label: "History",
          // icon: BarChart3,
          href: "/settings/medical-history"
        },
      ],
    },
  ],
  // footerGroup: {
  //   title: "Support",
  //   items: [
  //     { label: "Help Center",
  //       //  icon: HelpCircle,
  //         href: "#" },
  //     { label: "Settings",
  //       //  icon: Settings,
  //         href: "#" },
  //   ],
  // },
};

function isCurrentRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getCurrentPageLabel(pathname: string): string {
  const currentItem = sidebarData.navGroups
    .flatMap((group) => group.items)
    .find((item) => isCurrentRoute(pathname, item.href));

  if (currentItem) return currentItem.label;
  if (pathname === "/settings") return "Settings";

  const pageSegment = pathname.split("/").filter(Boolean).at(-1);
  if (!pageSegment) return "Home";

  return pageSegment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const AppSidebar = ({ className, ...props }: React.ComponentProps<typeof Sidebar>) => {
  const { pathname } = useLocation();

  return (
    <Sidebar
      className={cn("top-16 h-[calc(100svh-4rem)]", className)}
      {...props}
    >
      {/* <SidebarHeader>
        <SidebarLogo logo={sidebarData.logo} />
      </SidebarHeader> */}
      <SidebarContent>
        {sidebarData.navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={isCurrentRoute(pathname, item.href)}
                      render={<Link to={item.href} />}
                    >
                      {item.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup>
          {/* <SidebarGroupLabel>{sidebarData.footerGroup.title}</SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu>
              {/* {sidebarData.footerGroup.items.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton render={<a href={item.href} />}>{item.label}</SidebarMenuButton>
                </SidebarMenuItem>
              ))} */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

interface Sidebar1Props {
  className?: string;
  children?: ReactNode;
}

const Sidebar1 = ({ className, children }: Sidebar1Props) => {
  const { pathname } = useLocation();
  const currentPage = getCurrentPageLabel(pathname);

  return (
    <SidebarProvider
      className={cn("min-h-[calc(100svh-4rem)]", className)}
    >
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              {currentPage !== "Settings" && (
                <>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink render={<Link to="/settings/profile" />}>
                      Settings
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{currentPage}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="min-h-[calc(100svh-8rem)] flex-1 rounded-xl bg-muted/50 p-4 md:min-h-min">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export { Sidebar1 };
