import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Medical from "./pages/Medical/Medical";
import Settings from "./pages/Settings/Settings";
import Profile from "./pages/Settings/Profile";
import HamsterProfile from "./pages/Settings/HamsterProfile";
import Layout from "./layouts/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Verify from "./pages/Verify";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },

      {
        path: "home",
        element: <Home />,
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        ),
        children: [
          {
            path: "profile",
            element: <Profile />,
          },
          {
            path: "hamsterprofile",
            element: <HamsterProfile />,
          },
        ],
      },
      {
        path: "medical-checkup",
        element: (
          <ProtectedRoute>
            <Medical />
          </ProtectedRoute>
        ),
      }
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },

  {
    path: "/verify-email",
    element: <Verify />,
  },
]);

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer position="top-right" />
    </>
  );
}

export default App;