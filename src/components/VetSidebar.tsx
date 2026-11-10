import { LogOut } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Separator } from "@/components/ui/separator";
import { signOut } from "@/services/AccountService";
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
      title: "Dashboard",
      items: [
        {
          label: "View-Schedule",
          href: "/veterinarian/view-schedule",
        },
        // {
        //   label: "Hamsters",
        //   // icon: ClipboardList,
        //   href: "/settings/hamsterprofile"
        // },
        // {
        //   label: "History",
        //   // icon: BarChart3,
        //   href: "/settings/medical-history"
        // },
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

const AppSidebar = ({ className, ...props }: React.ComponentProps<typeof Sidebar>) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

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
          <Separator className="my-1" />
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  variant="outline"
                  className="justify-start border-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

interface VetSidebarProps {
  className?: string;
  children?: ReactNode;
}

const VetSidebar = ({ className, children }: VetSidebarProps) => {
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

export { VetSidebar };
