/* AuthShell — stripped for auth rebuild.
   Renders only the form outlet, no presentation panel. */
import { Outlet } from 'react-router-dom';

export function AuthShell() {
  return <Outlet />;
}
