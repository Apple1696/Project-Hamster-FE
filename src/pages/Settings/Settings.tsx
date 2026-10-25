import { Sidebar1 } from "../../components/sidebar1";
import { Outlet } from "react-router-dom";

const Settings = () => {
  return (
    <Sidebar1>
      <Outlet />
    </Sidebar1>
  );
};

export default Settings;