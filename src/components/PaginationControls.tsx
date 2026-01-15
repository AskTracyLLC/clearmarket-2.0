import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  className?: string;
  /** Show compact version for mobile */
  compact?: boolean;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  hasNextPage,
  hasPrevPage,
  className,
  compact = false,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers to display
  const getVisiblePages = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = compact ? 3 : 5;

    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <Pagination className={cn("mt-4", className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => hasPrevPage && onPageChange(currentPage - 1)}
            className={cn(
              "cursor-pointer",
              !hasPrevPage && "pointer-events-none opacity-50"
            )}
          />
        </PaginationItem>

        {!compact &&
          visiblePages.map((page, idx) =>
            page === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => onPageChange(page)}
                  isActive={page === currentPage}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}

        {compact && (
          <PaginationItem>
            <span className="px-2 text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationNext
            onClick={() => hasNextPage && onPageChange(currentPage + 1)}
            className={cn(
              "cursor-pointer",
              !hasNextPage && "pointer-events-none opacity-50"
            )}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
