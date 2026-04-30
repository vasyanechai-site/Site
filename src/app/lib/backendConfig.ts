import { projectId } from "../utils/supabase/info";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `https://${projectId}.supabase.co/functions/v1/make-server-aa167a09`;
