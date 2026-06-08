// client/src/components/engineer/ProjectScopePicker.jsx
// Shared project selector used by the project-scoped pages (Docs, Check-ins,
// Issues) when accessed without a ?project=<id> query param. Renders a Select of
// the user's projects; the parent owns the selected id and updates the URL.

import { Link } from 'react-router-dom';
import { Card, CardBody } from '../ui/Card';
import { Select } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { Wrench } from 'lucide-react';

/**
 * @param {{
 *   projects: Object[] | null,
 *   selectedId: string,                     // '' when none selected
 *   onSelect: (id: string) => void,
 *   label?: string,
 * }} props
 */
export function ProjectScopePicker({ projects, selectedId, onSelect, label = 'Project' }) {
  if (projects && projects.length === 0) {
    return (
      <Card>
        <CardBody className="p-0">
          <EmptyState
            icon={Wrench}
            title="No projects yet"
            message="Create a project first — documents, check-ins, and issues attach to a project."
            action={
              <Link to="/engineer">
                <Button variant="primary" size="sm">Go to Projects</Button>
              </Link>
            }
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <Select
          id="project-scope"
          label={label}
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">Select a project…</option>
          {(projects ?? []).map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </CardBody>
    </Card>
  );
}
