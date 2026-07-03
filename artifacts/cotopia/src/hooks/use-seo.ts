import { useEffect } from "react";

const SITE_NAME = "Everyday Radio by Cotopia";
const DEFAULT_DESCRIPTION =
  "Cotopia — Everyday Radio. Discover emerging artists, stream exclusive music and videos, and connect with a community that lives for music.";

interface SeoOptions {
  title: string;
  description?: string;
  image?: string;
  type?: "website" | "article" | "music.song" | "video.other" | "profile";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Sets per-page document title, meta description, canonical URL, and
 * Open Graph / Twitter tags. Cleans up structured data and restores
 * site-wide defaults when the page unmounts.
 */
export function useSeo({ title, description, image, type = "website", noindex, jsonLd }: SeoOptions) {
  useEffect(() => {
    const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
    const desc = description?.trim() || DEFAULT_DESCRIPTION;
    const canonicalUrl = window.location.origin + window.location.pathname;

    document.title = fullTitle;
    setMeta("name", "description", desc);
    setLink("canonical", canonicalUrl);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);
    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }
    setMeta("name", "robots", noindex ? "noindex, follow" : "index, follow");

    let jsonLdEl: HTMLScriptElement | null = null;
    if (jsonLd) {
      jsonLdEl = document.createElement("script");
      jsonLdEl.type = "application/ld+json";
      jsonLdEl.text = JSON.stringify(jsonLd);
      document.head.appendChild(jsonLdEl);
    }

    return () => {
      document.title = SITE_NAME;
      setMeta("name", "description", DEFAULT_DESCRIPTION);
      setMeta("name", "robots", "index, follow");
      if (jsonLdEl) jsonLdEl.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, image, type, noindex, JSON.stringify(jsonLd)]);
}
