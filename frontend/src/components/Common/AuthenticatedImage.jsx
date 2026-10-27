import React, { useState, useEffect } from "react";
import axios from "axios";
import { getAuthToken, BACKEND_BASE } from "../../services/api";

/**
 * AuthenticatedImage component
 * Fetches media assets using HTTP Authorization Bearer headers rather than
 * exposing access tokens in URL query strings. Converts responses to secure
 * client-side object URLs and handles memory cleanup on unmount.
 */
const AuthenticatedImage = ({
  src,
  alt = "Road damage inspection preview",
  className = "",
  fallback = null,
  style = {},
  onClick = undefined,
}) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl = null;

    if (!src) {
      setBlobUrl(null);
      setLoading(false);
      return;
    }

    // Direct render for blob or data URIs
    if (src.startsWith("blob:") || src.startsWith("data:")) {
      setBlobUrl(src);
      setLoading(false);
      return;
    }

    // Normalize target URL
    let fullUrl = src;
    if (!src.startsWith("http://") && !src.startsWith("https://")) {
      const cleanPath = src.startsWith("/") ? src : `/${src}`;
      fullUrl = `${BACKEND_BASE}${cleanPath}`;
    }

    // Strip legacy ?token= query parameter if present
    try {
      const parsed = new URL(fullUrl, window.location.origin);
      if (parsed.searchParams.has("token")) {
        parsed.searchParams.delete("token");
        fullUrl = parsed.toString();
      }
    } catch (e) {
      // Proceed with original string if URL parse fails
    }

    setLoading(true);
    setHasError(false);

    const token = getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    axios
      .get(fullUrl, {
        headers,
        responseType: "blob",
        timeout: 30000,
      })
      .then((res) => {
        if (!isMounted) return;
        const objectUrl = URL.createObjectURL(res.data);
        currentObjectUrl = objectUrl;
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("[AuthenticatedImage] Failed to load image:", fullUrl, err);
        setHasError(true);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div
        className={`animate-pulse bg-slate-800/40 flex items-center justify-center ${className}`}
        style={style}
      >
        <span className="text-[10px] text-slate-400">Loading secure preview...</span>
      </div>
    );
  }

  if (hasError || !blobUrl) {
    if (fallback) return fallback;
    return (
      <div
        className={`bg-slate-900 border border-slate-700/50 flex flex-col items-center justify-center text-slate-400 text-xs p-3 ${className}`}
        style={style}
      >
        <span className="text-[10px] font-medium text-slate-400">Preview Unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      loading="lazy"
    />
  );
};

export default AuthenticatedImage;
