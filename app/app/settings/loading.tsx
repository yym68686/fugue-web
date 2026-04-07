import { ConsoleLoadingState } from "@/components/console/console-page-skeleton";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";

export default function SettingsLoading() {
  return (
    <ConsoleLoadingState label="Loading profile settings">
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <PanelTitle>Loading profile…</PanelTitle>
            <PanelCopy>Reading the account identity and linked sign-in methods.</PanelCopy>
          </PanelSection>
        </Panel>
      </div>
    </ConsoleLoadingState>
  );
}
