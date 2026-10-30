import type { MetadataRoute } from "next";
import { createDb, closeDb } from "../lib/db";

const SITE_URL = "https://ai-assisted-german-law.vercel.app";

const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1.0,
  },
  {
    url: `${SITE_URL}/search`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/chat`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    url: `${SITE_URL}/guidance`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  },
];

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let lawRoutes: MetadataRoute.Sitemap = [];

  try {
    const db = createDb();
    const data = db.prepare("SELECT key FROM laws ORDER BY key ASC").all() as {
      key: string;
    }[];
    closeDb(db);
    lawRoutes = data.map((law) => ({
      url: `${SITE_URL}/laws/${encodeURIComponent(law.key)}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    console.warn("[sitemap] Could not fetch law keys from database.");
  }

  return [...staticRoutes, ...lawRoutes];
}
