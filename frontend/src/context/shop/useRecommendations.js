import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const REFRESH_INTERACTIONS = new Set(["viewed", "purchased", "addedToCart"]);

export const useRecommendations = ({ backendUrl, token }) => {
  const [recommendations, setRecommendations] = useState([]);

  const getRecommendations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.post(
        `${backendUrl}/api/interaction/recommendations`,
        {},
        { headers: { token } }
      );
      if (response.data.success) {
        setRecommendations(response.data.products);
      }
    } catch {
      // non-critical
    }
  }, [token, backendUrl]);

  useEffect(() => {
    if (token) {
      getRecommendations();
    } else {
      setRecommendations([]);
    }
  }, [token, getRecommendations]);

  const trackInteraction = useCallback(
    async (productId, interactionType, value = 1) => {
      if (!token || !productId) return;
      try {
        await axios.post(
          `${backendUrl}/api/interaction/track`,
          { productId, interactionType, value },
          { headers: { token } }
        );
        if (REFRESH_INTERACTIONS.has(interactionType)) {
          getRecommendations();
        }
      } catch {
        // non-critical
      }
    },
    [token, backendUrl, getRecommendations]
  );

  return {
    recommendations,
    getRecommendations,
    trackInteraction,
  };
};
