import { createFileRoute } from "@tanstack/react-router";

import SkillIntakeWorkbench from "@/components/skill-intake-workbench";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return <SkillIntakeWorkbench />;
}
