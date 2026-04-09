"use client";

import { useState, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Calendar,
  User,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority } from "@/lib/types/platform";

// ---- Types ----

interface TaskListProps {
  tasks: Task[];
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onComplete?: (taskId: string) => void;
  className?: string;
}

type FilterTab = "all" | "open" | "in_progress" | "completed";

// ---- Helpers ----

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-gray-400/10 text-gray-600 border-gray-400/20 dark:text-gray-400",
  medium:
    "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  critical:
    "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
};

function formatDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86_400_000);

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

function isDueOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

// ---- Component ----

export function TaskList({
  tasks,
  onStatusChange,
  onComplete,
  className,
}: TaskListProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === "all") return true;
    return t.status === activeTab;
  });

  const handleToggle = useCallback(
    (task: Task) => {
      if (task.status === "completed") {
        onStatusChange?.(task.id, "open");
      } else {
        onComplete?.(task.id);
      }
    },
    [onStatusChange, onComplete]
  );

  return (
    <div className={cn("flex flex-col", className)}>
      <Tabs
        defaultValue="all"
        onValueChange={(v) => setActiveTab(v as FilterTab)}
      >
        <TabsList variant="line">
          <TabsTrigger value="all">
            All ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="open">
            Open ({tasks.filter((t) => t.status === "open").length})
          </TabsTrigger>
          <TabsTrigger value="in_progress">
            In Progress (
            {tasks.filter((t) => t.status === "in_progress").length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed (
            {tasks.filter((t) => t.status === "completed").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="mb-2 size-8 opacity-40" />
              <p>No tasks in this category</p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {filteredTasks.map((task) => {
                const due = formatDueDate(task.due_at);
                const overdue =
                  task.status !== "completed" && isDueOverdue(task.due_at);

                return (
                  <li
                    key={task.id}
                    className="flex items-start gap-3 py-3"
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggle(task)}
                      className="mt-0.5 shrink-0"
                      aria-label={
                        task.status === "completed"
                          ? "Mark incomplete"
                          : "Mark complete"
                      }
                    >
                      {task.status === "completed" ? (
                        <CheckCircle2 className="size-5 text-emerald-500" />
                      ) : (
                        <Circle className="size-5 text-muted-foreground/50 hover:text-foreground transition-colors" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span
                        className={cn(
                          "text-sm font-medium leading-snug",
                          task.status === "completed" &&
                            "text-muted-foreground line-through"
                        )}
                      >
                        {task.title}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {/* Priority */}
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4 rounded-full px-1.5 text-[10px] font-semibold capitalize",
                            PRIORITY_STYLES[task.priority]
                          )}
                        >
                          {task.priority}
                        </Badge>

                        {/* Assignee */}
                        {task.assigned_to && (
                          <span className="inline-flex items-center gap-1">
                            <User className="size-3" />
                            <span className="truncate max-w-[100px]">
                              {task.assigned_to}
                            </span>
                          </span>
                        )}

                        {/* Due date */}
                        {due && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              overdue && "text-red-600 dark:text-red-400"
                            )}
                          >
                            <Calendar className="size-3" />
                            {due}
                          </span>
                        )}

                        {/* Asset link */}
                        {task.asset && (
                          <a
                            href={`/assets/${task.asset.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            {task.asset.name}
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
