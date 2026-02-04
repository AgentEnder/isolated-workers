import { navigate } from 'vike/client/router';
import { applyBaseUrl } from '../utils/base-url';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function Link({
  href: rawHref,
  children,
  className,
  onClick,
}: LinkProps) {
  const href = applyBaseUrl(rawHref);
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Allow external links to work normally
    if (href.startsWith('http') || href.startsWith('//')) {
      if (onClick) onClick(e);
      return;
    }

    e.preventDefault();
    if (onClick) onClick(e);
    navigate(href);
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
