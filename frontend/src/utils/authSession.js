import axios from "axios";

const AUTH_PATHS_TO_SKIP = [
  "/api/user/login",
  "/api/user/register",
  "/api/user/verify-email",
  "/api/user/google",
  "/api/user/forgot-password",
  "/api/user/reset-password",
  "/api/user/refresh",
  "/api/user/logout",
];

let backendUrlValue = "";
let setTokenValue = () => {};
let clearSessionValue = () => {};
let refreshPromise = null;
let responseInterceptorId = null;

const shouldSkipRefresh = (url = "") =>
  AUTH_PATHS_TO_SKIP.some((path) => url.includes(path));

const hasTokenHeader = (headers) =>
  Boolean(headers && Object.prototype.hasOwnProperty.call(headers, "token"));

const setTokenHeader = (config, token) => {
  if (!config.headers) {
    config.headers = {};
  }
  config.headers.token = token;
};

const refreshAccessToken = async () => {
  if (!backendUrlValue) {
    throw new Error("Missing backend URL for auth refresh");
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${backendUrlValue}/api/user/refresh`,
        {},
        {
          withCredentials: true,
          _skipAuthRefresh: true,
        }
      )
      .then((response) => {
        const nextToken = response.data?.accessToken || "";
        if (!response.data?.success || !nextToken) {
          throw new Error(response.data?.message || "Unable to refresh access token");
        }
        setTokenValue(nextToken);
        return nextToken;
      })
      .catch((error) => {
        clearSessionValue();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const configureAuthSession = ({ backendUrl, setToken, clearSession }) => {
  backendUrlValue = backendUrl;
  setTokenValue = setToken;
  clearSessionValue = clearSession || (() => setTokenValue(""));

  axios.defaults.withCredentials = true;

  if (responseInterceptorId !== null) {
    axios.interceptors.response.eject(responseInterceptorId);
  }

  responseInterceptorId = axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error?.config;
      const status = error?.response?.status;

      if (
        status !== 401 ||
        !originalRequest ||
        originalRequest._retry ||
        originalRequest._skipAuthRefresh ||
        shouldSkipRefresh(originalRequest.url || "")
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const nextToken = await refreshAccessToken();
        if (hasTokenHeader(originalRequest.headers)) {
          setTokenHeader(originalRequest, nextToken);
        }
        return axios(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
  );

  return () => {
    if (responseInterceptorId !== null) {
      axios.interceptors.response.eject(responseInterceptorId);
      responseInterceptorId = null;
    }
  };
};
