import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import MainLayout from "./layouts/MainLayout";
import Loader from "./components/Common/Loader";

// Lazy load route pages for performance & safe code splitting
const Login = lazy(() => import("./pages/Auth/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const LiveMonitoring = lazy(() => import("./pages/LiveMonitoring/LiveMonitoring"));
const RoadDamage = lazy(() => import("./pages/RoadDamage/RoadDamage"));
const Incidents = lazy(() => import("./pages/Incidents/Incidents"));
const Maintenance = lazy(() => import("./pages/Maintenance/Maintenance"));
const Hospitals = lazy(() => import("./pages/Hospitals/Hospitals"));
const Analytics = lazy(() => import("./pages/Analytics/Analytics"));
const Settings = lazy(() => import("./pages/Settings/Settings"));
const VideoInspection = lazy(() => import("./pages/VideoInspection/VideoInspection"));
const DamageMap = lazy(() => import("./pages/DamageMap/DamageMap"));
const UserManagement = lazy(() => import("./pages/Users/UserManagement"));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">
              <Loader message="Loading application module..." />
            </div>
          }
        >
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Application Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="live-camera" element={<LiveMonitoring />} />

              {/* AI Road Inspections (Inspectors & Admins) */}
              <Route
                path="road-damage"
                element={
                  <ProtectedRoute allowedRoles={["admin", "inspector"]}>
                    <RoadDamage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="video-inspection"
                element={
                  <ProtectedRoute allowedRoles={["admin", "inspector"]}>
                    <VideoInspection />
                  </ProtectedRoute>
                }
              />

              {/* GIS Map & Operations */}
              <Route path="map" element={<DamageMap />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="hospitals" element={<Hospitals />} />
              <Route path="analytics" element={<Analytics />} />

              {/* User Access & Administration (Admin only) */}
              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />

              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Fallback to root */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;