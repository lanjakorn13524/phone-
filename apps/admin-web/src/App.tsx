import { useState } from 'react';
import { RequireStaff } from './components/RequireStaff';
import type { StaffUser } from './lib/supabase';
import { DashboardPage } from './pages/DashboardPage';
import { SitesPage } from './pages/SitesPage';

const TABS = [
  { id: 'dashboard', label: 'ภาพรวม', render: (staff: StaffUser) => <DashboardPage staff={staff} /> },
  { id: 'sites', label: 'เว็บย่อย', render: (staff: StaffUser) => <SitesPage staff={staff} /> },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <RequireStaff>
      {(staff) => (
        <>
          <nav className="mb-5 flex gap-4 border-b text-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={t.id === active.id ? 'page' : undefined}
                className={`-mb-px border-b-2 pb-2 ${
                  t.id === active.id
                    ? 'border-zinc-900 font-medium text-zinc-900'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {active.render(staff)}
        </>
      )}
    </RequireStaff>
  );
}
