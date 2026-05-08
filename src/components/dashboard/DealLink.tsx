import { ReactNode, MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { hubspotDealUrl } from "@/lib/hubspot";

interface Props {
  id: number | string | null | undefined;
  children: ReactNode;
  className?: string;
}

export const DealLink = ({ id, children, className }: Props) => {
  if (id === null || id === undefined || id === "" || id === 0) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a
      href={hubspotDealUrl(id)}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir no HubSpot"
      onClick={(e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
      className={cn(
        "transition-colors hover:text-primary hover:underline underline-offset-2",
        className,
      )}
    >
      {children}
    </a>
  );
};
