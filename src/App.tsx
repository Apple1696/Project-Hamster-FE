import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import Medical from "./pages/Customer/Medical/Medical";
import MedicalHistory from "./pages/Customer/History/MedicalHistory";
import Settings from "./pages/Customer/Settings/Settings";
import Profile from "./pages/Customer/Settings/Profile";
import HamsterProfile from "./pages/Customer/Settings/HamsterProfile";
import ViewAppointment from "./pages/Veterinarian/ViewAppointment";
import VetLayout from "./pages/Veterinarian/VetLayout";
import Layout from "./layouts/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Verify from "./pages/Verify";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import CreateVetAccount from "./pages/Admin/CreateVetAccount";

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
          {
            path: "medical-history",
            element: <MedicalHistory />,
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
      },
    ],
  },
  {
    path: "/veterinarian",
    element: (
      <ProtectedRoute requiredRole="veterinarian">
        <VetLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="view-schedule" replace />,
      },
      {
        path: "view-schedule",
        element: <ViewAppointment />,
      },
    ],
  },
  // {
  //   path: "/view-schedule",
  //   element: (
  //     <ProtectedRoute requiredRole="veterinarian">
  //       <ViewAppointment />
  //     </ProtectedRoute>
  //   ),
  // },
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
  {
    path: "/create-vet-account",
    element: <CreateVetAccount />,
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