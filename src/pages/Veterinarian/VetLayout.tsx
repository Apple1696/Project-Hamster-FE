import { Outlet } from "react-router-dom";
import { VetSidebar } from "@/components/VetSidebar";

const VetLayout = () => {
  return (
    <VetSidebar>
      <Outlet />
    </VetSidebar>
  );
};

export default VetLayout;