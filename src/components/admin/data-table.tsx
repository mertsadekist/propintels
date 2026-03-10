import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableProps {
  headers: string[];
  children: React.ReactNode;
  isLoading?: boolean;
  footer?: React.ReactNode;
}

export function DataTable({ headers, children, isLoading, footer }: DataTableProps) {
  if (isLoading) {
    return (
      <Card className="border border-gray-200">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {headers.map((header) => (
                <th
                  key={header}
                  className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-gray-100">{footer}</div>
      )}
    </Card>
  );
}
