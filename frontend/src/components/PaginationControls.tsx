import React from 'react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

function getPageNumbers(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: PageItem[] = [1];

  if (current > 3) pages.push('ellipsis-left');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('ellipsis-right');

  pages.push(total);
  return pages;
}

const PageButton: React.FC<{
  page: number;
  isActive: boolean;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}> = ({ page, isActive, isLoading, onPageChange }) => {
  let className: string;
  if (isActive) {
    className = 'bg-[#b79753] text-[#0b3332] border-[#b79753] shadow-md shadow-[#b79753]/30';
  } else if (isLoading) {
    className = 'bg-[#0b3332] text-slate-500 border-[#1a6866] cursor-not-allowed';
  } else {
    className = 'bg-[#0b3332] text-gray-300 border-[#1a6866] hover:border-[#b79753]/50 hover:text-[#b79753]';
  }

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={() => onPageChange(page)}
      aria-label={`Página ${page}`}
      aria-current={isActive ? 'page' : undefined}
      className={`min-w-[2rem] px-2 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${className}`}
    >
      {page}
    </button>
  );
};

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  isLoading = false,
  onPageChange,
}) => {
  if (totalItems === 0) return null;

  const isPrevDisabled = currentPage <= 1 || isLoading;
  const isNextDisabled = currentPage >= totalPages || isLoading;
  const pages = getPageNumbers(currentPage, totalPages || 1);

  return (
    <div className="flex justify-center mt-8">
      <div className="flex items-center gap-1.5 bg-[#104443] px-4 py-3 rounded-2xl border border-[#1a6866] shadow-xl">
        {/* Anterior */}
        <button
          type="button"
          disabled={isPrevDisabled}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Anterior"
          className={`px-3 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
            isPrevDisabled
              ? 'bg-[#0b3332] text-slate-500 border-[#1a6866] cursor-not-allowed'
              : 'bg-[#0b3332] text-[#b79753] border-[#b79753]/40 hover:bg-[#b79753] hover:text-[#0b3332] hover:border-[#b79753]'
          }`}
        >
          &larr;
        </button>

        {/* Números de página */}
        {pages.map((p) =>
          p === 'ellipsis-left' || p === 'ellipsis-right' ? (
            <span
              key={p}
              className="px-2 py-2 text-xs font-bold text-slate-500 select-none"
            >
              &hellip;
            </span>
          ) : (
            <PageButton
              key={p}
              page={p}
              isActive={p === currentPage}
              isLoading={isLoading}
              onPageChange={onPageChange}
            />
          ),
        )}

        {/* Siguiente */}
        <button
          type="button"
          disabled={isNextDisabled}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Siguiente"
          className={`px-3 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
            isNextDisabled
              ? 'bg-[#0b3332] text-slate-500 border-[#1a6866] cursor-not-allowed'
              : 'bg-[#0b3332] text-[#b79753] border-[#b79753]/40 hover:bg-[#b79753] hover:text-[#0b3332] hover:border-[#b79753]'
          }`}
        >
          &rarr;
        </button>
      </div>
    </div>
  );
};
