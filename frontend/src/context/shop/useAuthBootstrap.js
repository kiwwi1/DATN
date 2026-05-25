import { useEffect } from "react";
import axios from "axios";

export const useAuthBootstrap = ({ backendUrl, token, setToken }) => {
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const response = await axios.post(`${backendUrl}/api/user/refresh`, {});
        if (response.data.success && response.data.accessToken) {
          setToken(response.data.accessToken);
        }
      } catch {
        setToken("");
      }
    };

    if (!token) {
      restoreAuth();
    }
  }, [token, backendUrl, setToken]);
};
