import { useCallback, useEffect, useState } from "react";
import {
  listTemplates,
  loadTemplate,
  saveTemplate,
  deleteTemplate,
  getTemplateAudioFile,
  type Template,
  type TemplateMeta,
} from "./templates";

/**
 * React hook over the Template store. Keeps a subscribed list of
 * metadata rows in state and re-reads from the backing store on
 * mutation so the rest of the app updates without prop-drilling.
 *
 * One hook instance per tab — all callers see the same data.
 */

// Module-level pub/sub so multiple components stay in sync after a
// create / update / delete without each wiring their own listener.
type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((fn) => fn());

export function useTemplates() {
  const [rows, setRows] = useState<TemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await listTemplates();
    setRows(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  const create = useCallback(
    async (input: Parameters<typeof saveTemplate>[0]): Promise<Template> => {
      const t = await saveTemplate(input);
      notify();
      return t;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await deleteTemplate(id);
    notify();
  }, []);

  return {
    templates: rows,
    loading,
    refresh,
    create,
    remove,
    load: loadTemplate,
    getAudioFile: getTemplateAudioFile,
  };
}
