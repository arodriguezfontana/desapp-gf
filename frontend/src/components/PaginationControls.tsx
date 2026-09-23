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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 bg-[#104443] px-6 py-4 rounded-2xl border border-[#1a6866] shadow-xl">
      <div className="text-xs sm:text-sm text-gray-300 font-semibold">
        Mostrando <span className="font-black text-[#b79753]">{startRange}</span> -{' '}
        <span className="font-black text-[#b79753]">{endRange}</span> de{' '}
        <span className="font-black text-[#b79753]">{totalItems}</span> jugadores
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="button"
          disabled={isPrevDisabled}
          onClick={() => onPageChange(currentPage - 1)}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
            isPrevDisabled
              ? 'bg-[#0b3332] text-slate-500 border-[#1a6866] cursor-not-allowed'
              : 'bg-[#b79753] text-[#0b3332] border-[#b79753] hover:bg-[#9e8144] shadow-md shadow-[#b79753]/30'
          }`}
        >
          &larr; Anterior
        </button>

        <span className="text-xs font-bold text-gray-400 px-2">
          Página {currentPage} de {totalPages || 1}
        </span>

        <button
          type="button"
          disabled={isNextDisabled}
          onClick={() => onPageChange(currentPage + 1)}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
            isNextDisabled
              ? 'bg-[#0b3332] text-slate-500 border-[#1a6866] cursor-not-allowed'
              : 'bg-[#b79753] text-[#0b3332] border-[#b79753] hover:bg-[#9e8144] shadow-md shadow-[#b79753]/30'
          }`}
        >
          Siguiente &rarr;
        </button>
      </div>
    </div>
  );
};
