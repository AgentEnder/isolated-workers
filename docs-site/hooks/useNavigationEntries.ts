import { usePageContext } from 'vike-react/usePageContext';

export function useNavigationEntries() {
  const pageContext = usePageContext();

  return pageContext.globalContext.navigation ?? [];
}
