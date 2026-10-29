// Request and task statuses for the Team Lead's work, shared by server code and page components.

export const REQUEST_STATUSES = ['new', 'planning', 'questions', 'plan_ready', 'approved', 'building', 'ready', 'going_live', 'live', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS: Record<RequestStatus, { label: string; hint: string; tone: 'grey' | 'amber' | 'blue' | 'green' | 'red' }> = {
  new: { label: 'New', hint: 'Waiting for Arvind to plan it', tone: 'grey' },
  planning: { label: 'Planning', hint: 'Arvind is writing the plan', tone: 'blue' },
  questions: { label: 'Question for you', hint: 'Arvind needs an answer before planning', tone: 'amber' },
  plan_ready: { label: 'Plan ready', hint: 'Checkpoint 1: approve the plan or ask for changes', tone: 'amber' },
  approved: { label: 'Approved', hint: 'Arvind is setting up the work', tone: 'blue' },
  building: { label: 'Building', hint: 'Nikhil builds, Pooja tests', tone: 'blue' },
  ready: { label: 'Ready to go live', hint: 'Checkpoint 2: try the preview, then approve going live', tone: 'amber' },
  going_live: { label: 'Going live', hint: 'Arvind is merging and deploying', tone: 'blue' },
  live: { label: 'Live', hint: 'Done and deployed', tone: 'green' },
  cancelled: { label: 'Cancelled', hint: 'Stopped', tone: 'grey' },
};

export const TASK_STATUSES = ['planned', 'todo', 'in_progress', 'testing', 'changes_needed', 'passed', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  planned: 'Planned',
  todo: 'To do',
  in_progress: 'In progress',
  testing: 'Testing',
  changes_needed: 'Changes needed',
  passed: 'Passed',
  done: 'Done',
};

