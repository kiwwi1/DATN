import React from "react";
import { ToastContainer, toast } from "react-toastify";
import Navbar from "./components/Navbar";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Add from "./pages/Add";
import List from "./pages/List";
import Orders from "./pages/Orders";
import Stats from "./pages/Stats";
import Login from "./components/Login";
import VendorValidator from "./components/VendorValidator";
import { useState, useEffect, useRef } from "react";
import 'react-toastify/dist/ReactToastify.css';

export const backendUrl = import.meta.env.VITE_BACKEND_URL;

const App = () => {
  const [token, setToken] = useState("");
  const [vendorInfo, setVendorInfo] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sseRef = useRef(null);

  const handleLogin = (tok, rememberMe = true) => {
    setToken(tok);
    if (rememberMe) {
      localStorage.setItem("token", tok);
      sessionStorage.removeItem("token");
    } else {
      sessionStorage.setItem("token", tok);
      localStorage.removeItem("token");
    }
  };

  const handleLogout = () => {
    setToken("");
    setVendorInfo(null);
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("vendorToken");
  };

  const loadVendorInfo = async (tok) => {
    try {
      const res = await fetch(`${backendUrl}/api/user/profile`, {
        method: 'POST',
        headers: { token: tok, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) setVendorInfo(data.user);
    } catch { /* non-critical */ }
  };

  const loadNotifications = async (tok) => {
    try {
      const res = await fetch(`${backendUrl}/api/notification/list`, { headers: { token: tok } });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n) => !n.read).length);
      }
    } catch { /* non-critical */ }
  };

  const markAllRead = async (tok) => {
    try {
      await fetch(`${backendUrl}/api/notification/read-all`, { method: 'POST', headers: { token: tok } });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const vendorTokenFromUrl = urlParams.get("vendorToken");

    if (vendorTokenFromUrl) {
      setToken(vendorTokenFromUrl);
      localStorage.setItem("token", vendorTokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const savedToken = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (savedToken) setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadVendorInfo(token);
    loadNotifications(token);

    const es = new EventSource(`${backendUrl}/api/notification/stream?token=${token}`);
    sseRef.current = es;
    es.onmessage = (e) => {
      try {
        const n = JSON.parse(e.data);
        setNotifications((prev) => [n, ...prev]);
        setUnreadCount((c) => c + 1);
        toast.info(n.title, { autoClose: 4000 });
      } catch { /* ignore */ }
    };
    es.onerror = () => { es.close(); sseRef.current = null; };
    return () => { es.close(); sseRef.current = null; };
  }, [token]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <ToastContainer />
      {token === "" ? (
        <Login onLogin={handleLogin} />
      ) : (
        <VendorValidator token={token} onLogout={handleLogout}>
          <Navbar
            onLogout={handleLogout}
            vendorInfo={vendorInfo}
            unreadCount={unreadCount}
            notifications={notifications}
            markAllRead={() => markAllRead(token)}
          />
          <hr />
          <div className="w-full flex">
            <Sidebar />
            <div className="w-[70%] mx-auto ml-[max(5vw,25px)] my-8 text-gray-600 text-base">
              <Routes>
                <Route path="/" element={<Navigate to="/stats" replace />} />
                <Route path="/stats" element={<Stats token={token} />} />
                <Route path="/add" element={<Add token={token} />} />
                <Route path="/list" element={<List token={token} />} />
                <Route path="/orders" element={<Orders token={token} />} />
              </Routes>
            </div>
          </div>
        </VendorValidator>
      )}
    </div>
  );
};

export default App;
