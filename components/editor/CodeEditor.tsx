"use client";

import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { EditorView } from "@codemirror/view";
import { createEditorState, type LinkSuggestion } from "./codemirror";

interface Props {
  initialValue: string;
  suggestions: LinkSuggestion[];
  /** Renseigné avec la vue CodeMirror une fois montée (pour la barre d'outils). */
  viewRef: RefObject<EditorView | null>;
  onChange: (value: string) => void;
  onImages: (files: File[], position: number) => void;
}

/** Monte CodeMirror une seule fois : le document vit ensuite dans l'éditeur, pas dans React. */
export function CodeEditor({ initialValue, suggestions, viewRef, onChange, onImages }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handleChange = useEffectEvent((value: string) => onChange(value));
  const handleImages = useEffectEvent((files: File[], position: number) => onImages(files, position));
  const initialState = useEffectEvent(() =>
    createEditorState(initialValue, suggestions, {
      onChange: (value) => handleChange(value),
      onImages: (files, position) => handleImages(files, position),
    }),
  );

  useEffect(() => {
    const view = new EditorView({ state: initialState(), parent: host.current! });
    viewRef.current = view;
    view.focus();
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [viewRef]);

  return <div ref={host} className="grimoire-editor" />;
}
