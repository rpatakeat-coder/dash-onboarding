import { createContext, useContext } from "react";

interface Ctx {
  open: () => void;
}

export const PreferencesDialogContext = createContext<Ctx>({ open: () => {} });

export const usePreferencesDialog = () => useContext(PreferencesDialogContext);
