// client/src/components/engineer/CheckinForm.jsx
// Controlled weekly check-in form. Self-contained (owns its field state); the
// parent passes an async onSubmit that posts the check-in. Designed to live
// inside a Modal but usable inline on a page as well.
//
// Renders its own action buttons unless `renderFooter` is false, in which case
// the parent (e.g. a Modal footer) drives submission via the returned handler —
// here we keep it simple and always render an inline submit row.

import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useToast } from '../../hooks/useToast';

/** Monday of the current week as a YYYY-MM-DD string (default week_start). */
function currentWeekStart() {
  const d = new Date();
  const day = d.getDay();                 // 0 Sun … 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const emptyForm = () => ({
  week_start:      currentWeekStart(),
  achievements:    '',
  plans_next:      '',
  blockers:        '',
  bugs_discovered: '',
  concerns:        '',
});

/**
 * @param {{
 *   onSubmit: (data: Object) => Promise<void>,
 *   onCancel?: () => void,
 * }} props
 */
export function CheckinForm({ onSubmit, onCancel }) {
  const { addToast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset to a fresh week whenever the form is re-mounted by the parent (key).
  useEffect(() => { setForm(emptyForm()); setErrors({}); }, []);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.week_start) { setErrors({ week_start: 'Week start is required.' }); return; }
    setSubmitting(true);
    try {
      const payload = {
        week_start:      form.week_start,
        achievements:    form.achievements.trim() || undefined,
        plans_next:      form.plans_next.trim() || undefined,
        blockers:        form.blockers.trim() || undefined,
        bugs_discovered: form.bugs_discovered.trim() || undefined,
        concerns:        form.concerns.trim() || undefined,
      };
      await onSubmit(payload);
      addToast({ type: 'success', title: 'Check-in logged' });
      setForm(emptyForm());
    } catch (err) {
      setErrors({ _global: err.message });
      addToast({ type: 'error', title: 'Check-in failed', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {errors._global && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
          {errors._global}
        </p>
      )}

      <Input
        id="checkin-week"
        label="Week starting"
        type="date"
        value={form.week_start}
        onChange={set('week_start')}
        error={errors.week_start}
      />

      <Textarea
        id="checkin-achievements"
        label="Achievements"
        placeholder="What got done this week?"
        value={form.achievements}
        onChange={set('achievements')}
        rows={3}
      />

      <Textarea
        id="checkin-plans"
        label="Plans for next week"
        placeholder="What's the focus next week?"
        value={form.plans_next}
        onChange={set('plans_next')}
        rows={3}
      />

      <Textarea
        id="checkin-blockers"
        label="Blockers"
        placeholder="Anything stopping progress? (leave empty if none)"
        value={form.blockers}
        onChange={set('blockers')}
        rows={2}
        helperText="If this is non-empty, the project is flagged as blocked."
      />

      <Textarea
        id="checkin-bugs"
        label="Bugs discovered"
        placeholder="Bugs found this week — promote them to issues from the table."
        value={form.bugs_discovered}
        onChange={set('bugs_discovered')}
        rows={2}
      />

      <Textarea
        id="checkin-concerns"
        label="Concerns"
        placeholder="Risks, doubts, or open questions."
        value={form.concerns}
        onChange={set('concerns')}
        rows={2}
      />

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button variant="secondary" size="md" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Logging…' : 'Log Check-in'}
        </Button>
      </div>
    </div>
  );
}
