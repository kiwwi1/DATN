import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export const useNotifications = ({ backendUrl, token }) => {
  const [notifications, setNotifications] = useState([]);
  const sseRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/notification/list`, {
        params: { audience: "user" },
      });
      if (response.data.success) {
        setNotifications(response.data.notifications);
      }
    } catch {
      // non-critical
    }
  }, [backendUrl]);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await axios.post(`${backendUrl}/api/notification/read-all`, { audience: "user" });
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    } catch {
      // non-critical
    }
  }, [backendUrl]);

  useEffect(() => {
    if (!token) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      setNotifications([]);
      return;
    }

    loadNotifications();
    const eventSource = new EventSource(
      `${backendUrl}/api/notification/stream?audience=user`,
      { withCredentials: true }
    );
    sseRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data);
        setNotifications((prev) => [notification, ...prev]);
        toast.info(notification.title, { autoClose: 4000 });
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      sseRef.current = null;
    };

    return () => {
      eventSource.close();
      sseRef.current = null;
    };
  }, [token, backendUrl, loadNotifications]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return {
    notifications,
    unreadCount,
    loadNotifications,
    markAllNotificationsRead,
  };
};
