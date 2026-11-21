import { supabase } from "@/lib/supabase";

export interface SiteConfig {
  id: number;
  maintenance_mode: boolean;
  maintenance_message: string;
  watch_party_enabled: boolean;
  downloads_enabled: boolean;
  guest_mode_enabled: boolean;
  signups_enabled: boolean;
  disabled_servers: string[];
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  id: 1,
  maintenance_mode: false,
  maintenance_message: "We are upgrading Stream Freak servers for faster HD playback. Back shortly!",
  watch_party_enabled: true,
  downloads_enabled: true,
  guest_mode_enabled: true,
  signups_enabled: true,
  disabled_servers: [],
};

export async function fetchSiteConfig(): Promise<SiteConfig> {
  try {
    const { data, error } = await supabase
      .from("site_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return DEFAULT_SITE_CONFIG;
    return {
      ...DEFAULT_SITE_CONFIG,
      ...data,
      disabled_servers: Array.isArray(data.disabled_servers) ? data.disabled_servers : [],
    };
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}
