export const OPEN_CREATE_PROJECT_DIALOG_EVENT = "fugue:console:create-project:open";

export function dispatchOpenCreateProjectDialogEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(OPEN_CREATE_PROJECT_DIALOG_EVENT));
}
