import { jwtDecode } from "jwt-decode";

export const decodeUserIdFromToken = (token) => {
  try {
    if (!token) return null;
    const decoded = jwtDecode(token);
    return decoded.id || decoded.userId || decoded._id || null;
  } catch (error) {
    console.log("Error decoding token:", error);
    return null;
  }
};
