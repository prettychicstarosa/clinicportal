import { LoadingScreen } from "@/components/LoadingScreen";
import { getSettings } from "@/lib/settings";

export default async function Loading() {
  const s = await getSettings().catch(() => null);
  return <LoadingScreen logoUrl={s?.logo_url ?? null} name={s?.clinic_name} />;
}
