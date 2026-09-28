import { RequireStaff } from './components/RequireStaff';
import { SitesPage } from './pages/SitesPage';

export default function App() {
  return <RequireStaff>{(staff) => <SitesPage staff={staff} />}</RequireStaff>;
}
