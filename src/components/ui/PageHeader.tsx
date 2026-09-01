import React from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

/**
 * Reusable page header with eyebrow label, H1 title, optional description, and action slot.
 * Replaces the eyebrow + h1 + p pattern repeated on every page.
 */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider mb-1">
            {eyebrow}
          </div>
        )}
        <h1 className="text-4xl font-light text-white tracking-tight">{title}</h1>
        {description && <p className="text-zinc-400 mt-2">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
