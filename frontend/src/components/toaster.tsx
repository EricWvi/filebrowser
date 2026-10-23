import { useToast } from "@/lib/toast";

export function Toaster() {
  const t = useToast();
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center">
      <div key={t.id} className="rounded-[4px] bg-fg px-3 py-1.5 text-[13px] text-bg shadow">
        {t.text}
      </div>
    </div>
  );
}
