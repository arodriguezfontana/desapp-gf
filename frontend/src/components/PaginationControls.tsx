import React from 'react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  isLoading = false,
  onPageChange,
}) => {
  if (totalItems === 0) return null;

  const startRange = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endRange = Math.min(currentPage * pageSize, totalItems);

  const isPrevDisabled = currentPage <= 1 || isLoading;
  const isNextDisabled = currentPage >= totalPages || isLoading;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 bg-white px-6 py-4 rounded-xl border border-emerald-900/10 shadow-sm">
      <div className="text-sm text-gray-700 font-medium">
        Mostrando <span className="font-bold text-emerald-900">{startRange}</span> -{' '}
        <span className="font-bold text-emerald-900">{endRange}</span> de{' '}
        <span className="font-bold text-emerald-900">{totalItems}</span> jugadores
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="button"
          disabled={isPrevDisabled}
          onClick={() => onPageChange(currentPage - 1)}
          className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
            isPrevDisabled
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-emerald-900 text-white border-emerald-900 hover:bg-emerald-800 shadow-sm'
          }`}
        >
          &larr; Anterior
        </button>

        <span className="text-xs font-semibold text-gray-500 px-2">
          Página {currentPage} de {totalPages || 1}
        </span>

        <button
          type="button"
          disabled={isNextDisabled}
          onClick={() => onPageChange(currentPage + 1)}
          className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
            isNextDisabled
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-emerald-900 text-white border-emerald-900 hover:bg-emerald-800 shadow-sm'
          }`}
        >
          Siguiente &rarr;
        </button>
      </div>
    </div>
  );
};

