'use client';

interface ApplicableToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// Small labeled switch used for the "Quiz applicable" / "Feedback
// applicable" pair on ModuleModal/EventModal — toggling on reveals the
// matching QuizLinkPicker/FeedbackLinkPicker and makes that item mandatory
// for students; toggling off clears whatever was linked.
export default function ApplicableToggle({ label, checked, onChange }: ApplicableToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex-1 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10"
    >
      <span className="text-xs font-medium text-white/70">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-white/15'}`}
      >
        <span
          className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(4px)' }}
        />
      </span>
    </button>
  );
}
