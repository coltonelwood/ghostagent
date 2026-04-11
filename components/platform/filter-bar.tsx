"use client";

import { useState } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------------
// Facet dropdown — multi-select with search
// --------------------------------------------------------------------------

export interface FacetOption {
  value: string;
  label: string;
  count?: number;
}

export interface FacetDropdownProps {
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
}

export function FacetDropdown({
  label,
  options,
  selected,
  onChange,
  searchable = true,
}: FacetDropdownProps) {
  const [search, setSearch] = useState("");

  const filtered = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selectedCount = selected.length;

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function clear() {
    onChange([]);
    setSearch("");
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <span className="text-xs font-medium">{label}</span>
            {selectedCount > 0 && (
              <span className="flex h-4 items-center rounded-sm bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                {selectedCount}
              </span>
            )}
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" side="bottom" sideOffset={4} className="w-64 p-0">
        {searchable && (
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Filter ${label.toLowerCase()}…`}
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No matches
            </div>
          ) : (
            filtered.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted"
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-sm border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <span className="flex-1 truncate text-foreground">
                    {option.label}
                  </span>
                  {typeof option.count === "number" && (
                    <span className="text-[10px] text-muted-foreground nx-tabular">
                      {option.count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {selectedCount > 0 && (
          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={clear}
              className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="size-3" />
              Clear selection
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// --------------------------------------------------------------------------
// Filter bar — wraps search + facets + saved views
// --------------------------------------------------------------------------

export interface SavedView {
  id: string;
  label: string;
}

export interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  facets?: React.ReactNode;
  savedViews?: SavedView[];
  activeView?: string;
  onViewChange?: (id: string) => void;
  rightActions?: React.ReactNode;
}

export function FilterBar({
  search,
  onSearchChange,
  facets,
  savedViews,
  activeView,
  onViewChange,
  rightActions,
}: FilterBarProps) {
  return (
    <div className="space-y-3">
      {savedViews && savedViews.length > 0 && (
        <div className="flex items-center gap-1 border-b border-border">
          {savedViews.map((view) => {
            const active = view.id === activeView;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onViewChange?.(view.id)}
                className={cn(
                  "relative -mb-px h-9 px-3 text-xs font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view.label}
                {active && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-primary"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="h-8 pl-8 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {facets}

        {rightActions && (
          <div className="ml-auto flex items-center gap-2">{rightActions}</div>
        )}
      </div>
    </div>
  );
}
