"use client";

import { useEffect, useState } from "react";
import { DEFAULT_FRAMEWORKS, type Framework } from "@/lib/frameworks";

export function SettingsMenu({
  frameworks,
  onSave,
}: {
  frameworks: Framework[];
  onSave: (frameworks: Framework[]) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Framework[]>(frameworks);

  // Keep the draft in sync whenever the modal is (re)opened.
  useEffect(() => {
    if (modalOpen) setDraft(frameworks);
  }, [modalOpen, frameworks]);

  // Close the dropdown on Escape.
  useEffect(() => {
    if (!menuOpen && !modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, modalOpen]);

  function updateRow(i: number, patch: Partial<Framework>) {
    setDraft((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function removeRow(i: number) {
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addRow() {
    setDraft((prev) => [
      ...prev,
      { id: `fw-${Date.now()}`, name: "", stages: [], description: "" },
    ]);
  }
  function save() {
    const cleaned = draft
      .map((f) => ({
        ...f,
        name: f.name.trim(),
        description: f.description.trim(),
        stages: f.stages.map((s) => s.trim()).filter(Boolean),
      }))
      .filter((f) => f.name.length > 0);
    onSave(cleaned.length > 0 ? cleaned : DEFAULT_FRAMEWORKS);
    setModalOpen(false);
  }

  return (
    <>
      <div className="menu-wrap">
        <button
          className="hamburger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        {menuOpen && (
          <>
            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="menu-dropdown" role="menu">
              <button
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  setModalOpen(true);
                }}
              >
                ⚙ Settings — Narrative frameworks
              </button>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Narrative frameworks</h2>
                <p className="hint">
                  The AI grader uses these to detect which format your copy follows. Edits
                  are saved in this browser and sent with each writing grade.
                </p>
              </div>
              <button className="modal-close" aria-label="Close" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="fw-list">
              {draft.map((f, i) => (
                <div className="fw-row" key={f.id}>
                  <div className="fw-row-top">
                    <input
                      className="fw-name"
                      value={f.name}
                      placeholder="Framework name (e.g. AIDA)"
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                    />
                    <button
                      className="fw-remove"
                      aria-label="Remove framework"
                      onClick={() => removeRow(i)}
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    className="fw-stages"
                    value={f.stages.join(", ")}
                    placeholder="Stages, comma-separated (e.g. Attention, Interest, Desire, Action)"
                    onChange={(e) =>
                      updateRow(i, { stages: e.target.value.split(",").map((s) => s) })
                    }
                  />
                  <textarea
                    className="fw-desc"
                    value={f.description}
                    placeholder="One-line description of what it is / when to use it"
                    rows={2}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <div className="modal-foot">
              <button className="btn small" onClick={addRow}>
                + Add framework
              </button>
              <button
                className="btn small"
                onClick={() => setDraft(DEFAULT_FRAMEWORKS.map((f) => ({ ...f })))}
              >
                Reset to defaults
              </button>
              <span className="spacer" />
              <button className="btn small" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn small primary" onClick={save}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
