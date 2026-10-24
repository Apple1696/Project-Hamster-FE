
import Header from "@/components/header";
import { Outlet } from "react-router-dom";
function Layout() {
    return (
        <div>
            <Header />
            <main>
                <Outlet />
            </main>
            {/* <Footer /> */}
        </div>
    );
}

export default Layout;