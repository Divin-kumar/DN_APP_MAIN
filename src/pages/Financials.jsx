import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, Landmark, Receipt, WalletCards } from 'lucide-react';

const views = [
  { label: 'Financial overview', path: '/financials', icon: WalletCards, detail: 'Keep money tracking secondary to your life events.' },
  { label: 'Income', path: '/financials/income', icon: Landmark, detail: 'Review and manage income records.' },
  { label: 'Expenses', path: '/financials/expenses', icon: Receipt, detail: 'Review spending and event-linked costs.' },
];

export default function Financials() {
  const location = useLocation();
  const isOverview = location.pathname === '/financials';

  return (
    <div className="financials-page feature-page">
      <div className="financials-heading">
        <div>
          <span className="eyebrow">Supporting view</span>
          <h2>Financials</h2>
          <p>Simple money tracking that supports the life you are organizing.</p>
        </div>
      </div>

      <div className="financials-nav" aria-label="Financial views">
        {views.map((view) => {
          const Icon = view.icon;
          return (
            <NavLink key={view.path} to={view.path} end={view.path === '/financials'} className={({ isActive }) => `financials-nav-card${isActive ? ' financials-nav-card-active' : ''}`}>
              <Icon size={18} />
              <span><strong>{view.label}</strong><small>{view.detail}</small></span>
              <ArrowRight size={16} />
            </NavLink>
          );
        })}
      </div>

      {isOverview ? (
        <div className="financials-empty-state">
          <WalletCards size={26} />
          <h3>Money stays in context</h3>
          <p>Use Income and Expenses when they help you understand an event. Your events remain useful with no financial records.</p>
        </div>
      ) : <Outlet />}
    </div>
  );
}
