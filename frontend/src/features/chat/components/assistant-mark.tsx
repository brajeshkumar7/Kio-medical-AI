import KioBrandMark from "@/components/brand/kio-brand";

export default function AssistantMark({ small = false }: { small?: boolean }) {
  return <KioBrandMark size={small ? 27 : 34} />;
}
