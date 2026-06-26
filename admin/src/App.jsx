import { ToastContainer, toast } from "react-toastify";
import Navbar from "./components/Navbar";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Add from "./pages/Add";
import List from "./pages/List";
import Orders from "./pages/Orders";
import Stats from "./pages/Stats";
import Chat from "./pages/Chat";
import Vouchers from "./pages/Vouchers";
import Simulator from "./pages/Simulator";
import Login from "./components/Login";
import VendorValidator from "./components/VendorValidator";
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import 'react-toastify/dist/ReactToastify.css';
import { configureAuthSession } from "./utils/authSession";

export const backendUrl = import.meta.env.VITE_BACKEND_URL;

const App = () => {
  const [token, setToken] = useState("");
  const [vendorInfo, setVendorInfo] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sseRef = useRef(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const clearSession = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    setToken("");
    setVendorInfo(null);
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post(`${backendUrl}/api/user/logout`, {}, { withCredentials: true });
    } catch {
      // noop
    }
    clearSession();
  };

  useEffect(
    () => configureAuthSession({ backendUrl, setToken, clearSession }),
    [backendUrl, clearSession, setToken]
  );

  const loadVendorInfo = async (tok) => {
    try {
      const response = await axios.post(`${backendUrl}/api/user/profile`, {}, { headers: { token: tok } });
      if (response.data.success) setVendorInfo(response.data.user);
      else setVendorInfo({ role: 'invalid' });
    } catch {
      setVendorInfo({ role: 'invalid' });
    }
  };

  const loadNotifications = async (tok) => {
    try {
      const response = await axios.get(`${backendUrl}/api/notification/list`, {
        params: { audience: 'vendor' },
        headers: { token: tok },
      });
      if (response.data.success) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.notifications.filter((n) => !n.read).length);
      }
    } catch { /* non-critical */ }
  };

  const markAllRead = async (tok) => {
    try {
      await axios.post(
        `${backendUrl}/api/notification/read-all`,
        { audience: 'vendor' },
        { headers: { token: tok } }
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const response = await axios.post(`${backendUrl}/api/user/refresh`, {}, { withCredentials: true });
        if (response.data.success && response.data.accessToken) {
          setToken(response.data.accessToken);
        }
      } catch {
        setToken("");
      } finally {
        setCheckingSession(false);
      }
    };
    restoreAuth();
  }, []);

  useEffect(() => {
    if (!token) {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      setVendorInfo(null);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadVendorInfo(token);
    loadNotifications(token);

    const es = new EventSource(`${backendUrl}/api/notification/stream?audience=vendor`, { withCredentials: true });
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
    <div className="admin-shell">
      <ToastContainer position="top-right" />
      {checkingSession ? (
        <Login isCheckingSession />
      ) : token === "" ? (
        <Login />
      ) : (
        <VendorValidator token={token} user={vendorInfo} onLogout={handleLogout}>
          <Navbar
            onLogout={handleLogout}
            vendorInfo={vendorInfo}
            unreadCount={unreadCount}
            notifications={notifications}
            markAllRead={() => markAllRead(token)}
          />
          <div className="admin-layout">
            <aside className="admin-sidebar">
              <Sidebar />
            </aside>
            <div className="admin-main">
              <Routes>
                <Route path="/" element={<Navigate to="/stats" replace />} />
                <Route path="/stats" element={<Stats token={token} />} />
                <Route path="/add" element={<Add token={token} />} />
                <Route path="/list" element={<List token={token} />} />
                <Route path="/orders" element={<Orders token={token} />} />
                <Route path="/vouchers" element={<Vouchers token={token} />} />
                <Route path="/chat" element={<Chat token={token} />} />
                <Route path="/simulator" element={<Simulator token={token} />} />
              </Routes>
            </div>
          </div>
        </VendorValidator>
      )}
    </div>
  );
};

export default App;
