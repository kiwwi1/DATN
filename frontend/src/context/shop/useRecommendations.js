import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

const DEBOUNCED_REFRESH_INTERACTIONS = new Set(["viewed", "clicked", "timeSpent"]);
const IMMEDIATE_REFRESH_INTERACTIONS = new Set(["purchased", "addedToCart", "wishlisted", "rated", "reviewed"]);
const REFRESH_DEBOUNCE_MS = 800;
const MIN_RECOMMENDATION_LIMIT = 20;
const MAX_RECOMMENDATION_LIMIT = 100;
const RECOMMENDATION_CATALOG_RATIO = 0.15;

const getRecommendationLimit = (productCount) => {
  if (!Number.isFinite(productCount) || productCount <= 0) {
    return MIN_RECOMMENDATION_LIMIT;
  }

  const scaledLimit = Math.ceil(productCount * RECOMMENDATION_CATALOG_RATIO);
  return Math.min(MAX_RECOMMENDATION_LIMIT, Math.max(MIN_RECOMMENDATION_LIMIT, scaledLimit));
};

export const useRecommendations = ({ backendUrl, productCount, token }) => {
  const [recommendations, setRecommendations] = useState([]);
  const refreshTimerRef = useRef(null);
  const recommendationLimit = getRecommendationLimit(productCount);

  const clearRefreshTimer = useCallback(() => {
    if (!refreshTimerRef.current) return;
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
  }, []);

  const getRecommendations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.post(
        `${backendUrl}/api/interaction/recommendations?limit=${recommendationLimit}`,
        {},
        { headers: { token } }
      );
      if (response.data.success) {
        setRecommendations(response.data.products);
      }
    } catch {
      // non-critical
    }
  }, [token, backendUrl, recommendationLimit]);

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
