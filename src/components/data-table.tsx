import type { TableHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Tabla semántica reutilizable: el tema se controla por los tokens de globals.css. */
export function DataTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table {...props} className={cn('gamu-table w-full text-sm', className)} />;
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={cn('gamu-table-head', className)} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={cn('gamu-table-body', className)} />;
}
