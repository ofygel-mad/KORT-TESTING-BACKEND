import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import type { OrgSummary } from '../../stores/auth';
import { api } from '../../api/client';
import type { AuthSessionResponse } from '../../api/contracts';
import { Tooltip } from '../Tooltip';
import styles from './OrgSwitcher.module.css';

type BootstrapWithOrgs = Omit<AuthSessionResponse, 'access' | 'refresh'> & { orgs?: OrgSummary[] };

interface OrgSwitcherProps {
  collapsed: boolean;
}

export function OrgSwitcher({ collapsed }: OrgSwitcherProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const org = useAuthStore((s) => s.org);
  const userOrgs = useAuthStore((s) => s.userOrgs);
  const selectedOrgId = useAuthStore((s) => s.selectedOrgId);
  const setSelectedOrgId = useAuthStore((s) => s.setSelectedOrgId);
  const syncSession = useAuthStore((s) => s.syncSession);

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (!org) return null;

  const currentId = selectedOrgId ?? org.id;
  const hasMultiple = userOrgs.length > 1;

  async function handleSwitch(target: OrgSummary) {
    if (target.id === currentId || switching) return;
    setOpen(false);
    setSwitching(true);
    setSelectedOrgId(target.id);

    try {
      const session = await api.get<BootstrapWithOrgs | null>('/auth/bootstrap/');
      if (session) {
        syncSession({
          user: session.user,
          org: session.org,
          capabilities: session.capabilities,
          role: session.role,
          membership: session.membership,
          orgs: session.orgs,
        });
      }
      qc.clear();
      navigate('/');
    } catch {
      setSelectedOrgId(currentId);
    } finally {
      setSwitching(false);
    }
  }

  const trigger = (
    <button
      className={`${styles.trigger} ${collapsed ? styles.triggerCollapsed : ''} ${switching ? styles.switching : ''}`}
      onClick={() => { if (!switching && hasMultiple && !collapsed) setOpen((v) => !v); }}
      aria-expanded={open}
      aria-label={`Компания: ${org.name}`}
    >
      <span className={styles.icon}>
        {switching ? <Loader2 size={14} className={styles.spinner} /> : <Building2 size={14} />}
      </span>
      {!collapsed && (
        <>
          <span className={styles.name}>{org.name}</span>
          {hasMultiple && (
            <ChevronDown
              size={12}
              className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            />
          )}
        </>
      )}
    </button>
  );

  return (
    <div className={styles.root}>
      {collapsed
        ? <Tooltip content={org.name} side="right">{trigger}</Tooltip>
        : trigger}

      {open && !collapsed && hasMultiple && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.dropdownLabel}>Компании</div>
            {userOrgs.map((o) => (
              <button
                key={o.id}
                className={`${styles.item} ${o.id === currentId ? styles.itemActive : ''}`}
                onClick={() => handleSwitch(o)}
              >
                <span className={styles.itemName}>{o.name}</span>
                <span className={styles.itemRole}>{o.role}</span>
                {o.id === currentId && <Check size={12} className={styles.check} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
