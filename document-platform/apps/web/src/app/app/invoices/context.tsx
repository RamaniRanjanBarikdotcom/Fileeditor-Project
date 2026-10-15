'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, type Business, type Meta } from './lib';

type InvoicingState = {
  meta: Meta | null;
  businesses: Business[];
  business: Business | null;
  loading: boolean;
  error: string;
  selectBusiness: (id: string) => void;
  reload: () => Promise<void>;
};

const InvoicingContext = createContext<InvoicingState | null>(null);
const ACTIVE_KEY = 'apptoolkitlab-invoice-business';

export function useInvoicing() {
  const value = useContext(InvoicingContext);
  if (!value) throw new Error('useInvoicing must be used inside InvoicingProvider.');
  return value;
}

export function InvoicingProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [metaData, list] = await Promise.all([api<Meta>('/invoicing/meta'), api<Business[]>('/invoicing/businesses')]);
      setMeta(metaData);
      setBusinesses(list);
      setError('');
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(ACTIVE_KEY);
      } catch {
        saved = null;
      }
      setActiveId((current) => {
        const preferred = current ?? saved;
        return list.some((business) => business.id === preferred) ? preferred : (list[0]?.id ?? null);
      });
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void reload();
  }, [reload]);

  const selectBusiness = (id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      // Remembering the choice is a convenience only.
    }
  };

  return (
    <InvoicingContext.Provider
      value={{
        meta,
        businesses,
        business: businesses.find((business) => business.id === activeId) ?? null,
        loading,
        error,
        selectBusiness,
        reload,
      }}
    >
      {children}
    </InvoicingContext.Provider>
  );
}
