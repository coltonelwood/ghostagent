# GhostAgent Operator Dashboard — Design Spec
# Status: DESIGNED, NOT IMPLEMENTED
# Deploy when: 10+ customers, $1K+ MRR, 2+ team members

## Route
/platform/operator (admin-only, gated by role === "owner")

## Tabs

### 1. Overview
- MRR (from Stripe API or operator_metrics_daily)
- Activated trials this week (from operator_metrics_daily.activation_count)
- Open critical incidents (from operator_incidents WHERE severity='critical' AND status != 'closed')
- Tasks running (from operator_tasks WHERE status='in_progress')
- Deploy status (from Vercel API or manual tracking)
- Top bottleneck (from latest planner cycle output)
- Top growth experiment (from operator_experiments WHERE status='running')
- Connector sync health (from connectors + connector_syncs — THIS ONE EXISTS TODAY)

### 2. Objectives
- List of operator_objectives with status, target metric, progress
- Create/edit/archive objectives
- Link to child tasks

### 3. Tasks
- Kanban or table view of operator_tasks
- Filter by status, agent_role, priority
- View task runs and outputs
- Manual task creation

### 4. Agents
- List of operator_agent_definitions
- Enable/disable agents
- View recent task_runs per agent
- Agent performance metrics (success rate, avg duration)

### 5. Experiments
- List of operator_experiments
- Create experiment with hypothesis + metric
- View results with statistical significance
- Start/pause/end experiments

### 6. Revenue
- MRR chart (daily from operator_metrics_daily)
- Customer count over time
- Churn tracking
- Plan distribution
- Requires: Stripe webhook integration

### 7. Incidents
- List of operator_incidents
- Create/update incidents
- Root cause + resolution tracking
- Severity distribution

### 8. Deployments
- Recent deploys (from Vercel API or git log)
- Deploy success/failure rate
- Rollback capability
- Linked to code_changes and task_runs

## Data Dependencies
- 11 operator_* tables from migration 012 (NOT YET DEPLOYED)
- Stripe API integration (NOT YET BUILT)
- Vercel API integration (NOT YET BUILT)
- Planner agent running on schedule (NOT YET BUILT)

## Prerequisites Before Building
1. Deploy migration 012_operator_layer_FUTURE.sql
2. Build API routes for each operator_* table
3. Integrate Stripe webhooks for revenue data
4. Build scheduled planner agent
5. Have actual data flowing through the system

## Components Needed
- OperatorLayout (tab navigation)
- MetricCard (reuse existing StatCard)
- ObjectiveRow
- TaskBoard (kanban or table)
- AgentCard
- ExperimentCard
- IncidentRow
- DeployRow
- MRRChart (line chart — add recharts or similar)

## Estimated Build Time
- API routes: 2-3 days
- UI components: 2-3 days
- Stripe integration: 1-2 days
- Vercel integration: 1 day
- Total: ~8-10 days of focused work

## When To Build
This dashboard becomes valuable when:
- You have paying customers generating real MRR data
- You have a team member who needs visibility into operations
- You have enough traffic to run experiments
- You have enough complexity that manual operations don't scale
