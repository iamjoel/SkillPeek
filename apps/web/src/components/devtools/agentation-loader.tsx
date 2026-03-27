import { useEffect, useState, type ComponentType } from "react";

type AgentationComponent = ComponentType<{
  className?: string;
}>;

export function AgentationLoader() {
  const [Agentation, setAgentation] = useState<AgentationComponent | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAgentation() {
      const module = await import("agentation");

      if (!cancelled) {
        setAgentation(() => module.Agentation);
      }
    }

    void loadAgentation();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!import.meta.env.DEV || !Agentation) {
    return null;
  }

  return <Agentation className="z-[70]" />;
}
