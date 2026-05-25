import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

const RECOMMENDATION_LIMIT = 40;
const DEBOUNCED_REFRESH_INTERACTIONS = new Set(["viewed", "clicked", "timeSpent"]);
const IMMEDIATE_REFRESH_INTERACTIONS = new Set(["purchased", "addedToCart", "wishlisted", "rated", "reviewed"]);
const REFRESH_DEBOUNCE_MS = 800;

export const useRecommendations = ({ backendUrl, token }) => {
  const [recommendations, setRecommendations] = useState([]);
  const refreshTimerRef = useRef(null);

  const clearRefreshTimer = useCallback(() => {
    if (!refreshTimerRef.current) return;
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
  }, []);

  const getRecommendations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.post(
        `${backendUrl}/api/interaction/recommendations?limit=${RECOMMENDATION_LIMIT}`,
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

  const scheduleRecommendationsRefresh = useCallback(
    (delayMs = REFRESH_DEBOUNCE_MS) => {
      if (!token) return;
      clearRefreshTimer();
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        getRecommendations();
      }, delayMs);
    },
    [token, clearRefreshTimer, getRecommendations]
  );

  useEffect(() => {
    if (token) {
      getRecommendations();
    } else {
      clearRefreshTimer();
      setRecommendations([]);
    }
  }, [token, getRecommendations, clearRefreshTimer]);

  useEffect(() => {
    return () => clearRefreshTimer();
  }, [clearRefreshTimer]);

  const trackInteraction = useCallback(
    async (productId, interactionType, value = 1) => {
      if (!token || !productId) return;
      try {
        await axios.post(
          `${backendUrl}/api/interaction/track`,
          { productId, interactionType, value },
          { headers: { token } }
        );

        if (IMMEDIATE_REFRESH_INTERACTIONS.has(interactionType)) {
          clearRefreshTimer();
          getRecommendations();
          return;
        }

        if (DEBOUNCED_REFRESH_INTERACTIONS.has(interactionType)) {
          scheduleRecommendationsRefresh();
        }
      } catch {
        // non-critical
      }
    },
    [token, backendUrl, getRecommendations, clearRefreshTimer, scheduleRecommendationsRefresh]
  );

  return {
    recommendations,
    getRecommendations,
    trackInteraction,
  };
};
