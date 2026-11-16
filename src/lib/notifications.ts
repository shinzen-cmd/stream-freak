import { supabase } from "@/lib/supabase";

export type NotificationTone = "info" | "success" | "warning" | "urgent";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  tone: NotificationTone;
  badge: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  dismissible: boolean;
  show_once: boolean;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

export type NotificationInput = Omit<AppNotification, "id" | "created_at">;

/**
 * Fetches currently active, non-expired popup notifications for any user.
 */
export async function fetchActiveNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const now = Date.now();
  return (data as AppNotification[]).filter(
    (n) => !n.expires_at || new Date(n.expires_at).getTime() > now
  );
}

/**
 * Fetches all notifications (active, paused, expired) for the admin dashboard.
 */
export async function fetchAllNotifications(): Promise<{ data: AppNotification[]; error: string | null }> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });

  return {
    data: (data as AppNotification[]) ?? [],
    error: error?.message ?? null,
  };
}

/**
 * Creates a new global popup notification (admin only via RLS).
 */
export async function createNotification(
  input: NotificationInput
): Promise<{ data: AppNotification | null; error: string | null }> {
  const { data, error } = await supabase
    .from("notifications")
    .insert(input)
    .select()
    .single();

  return {
    data: (data as AppNotification) ?? null,
    error: error?.message ?? null,
  };
}

/**
 * Updates an existing popup notification (admin only via RLS).
 */
export async function updateNotification(
  id: string,
  patch: Partial<NotificationInput>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("notifications")
    .update(patch)
    .eq("id", id);

  return { error: error?.message ?? null };
}

/**
 * Deletes a popup notification (admin only via RLS).
 */
export async function deleteNotification(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id);

  return { error: error?.message ?? null };
}
