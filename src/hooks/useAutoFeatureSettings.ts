import { useState, useEffect } from "react";
import {
  AutoFeatureSettings,
  getAutoFeatureSettings,
  saveAutoFeatureSettings,
  resetAutoFeatureSettings,
  subscribeAutoFeatureSettings,
} from "../services/settings/autoFeatureSettings";

export function useAutoFeatureSettings() {
  const [settings, setSettings] = useState<AutoFeatureSettings>(() => getAutoFeatureSettings());

  useEffect(() => {
    return subscribeAutoFeatureSettings((updated) => {
      setSettings({ ...updated });
    });
  }, []);

  const update = (partial: Partial<AutoFeatureSettings>) => {
    const next = saveAutoFeatureSettings(partial);
    setSettings(next);
  };

  const reset = () => {
    const def = resetAutoFeatureSettings();
    setSettings(def);
  };

  return {
    settings,
    update,
    reset,
  };
}
