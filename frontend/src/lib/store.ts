import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { setAccessToken } from './api';

interface User {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  status?: string;
  avatarUrl?: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: {
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
    avatarUrl?: string;
  }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (phone, password) => {
    const { data } = await api.post('/api/v1/auth/login', { phone, password });
    // Access token is stored in memory only — refresh token is in httpOnly cookie
    setAccessToken(data.accessToken);
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  register: async (regData) => {
    const { data } = await api.post('/api/v1/auth/register', regData);
    setAccessToken(data.accessToken);
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    api.post('/api/v1/auth/logout').catch(() => {});
    setAccessToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadUser: async () => {
    try {
      // On first load or page refresh the access token is not in memory.
      // Try to get a new one using the httpOnly refresh-token cookie.
      if (!window.__mall263_access_token_loaded) {
        window.__mall263_access_token_loaded = true;
        try {
          const { data: refreshData } = await api.post('/api/v1/auth/refresh', {}, { withCredentials: true });
          setAccessToken(refreshData.accessToken);
        } catch {
          // No valid session — user is logged out
          set({ isLoading: false });
          return;
        }
      }
      const { data } = await api.get('/api/v1/users/me');
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

// Augment window type for the one-time refresh flag
declare global {
  interface Window {
    __mall263_access_token_loaded?: boolean;
  }
}

interface CartItem {
  variantId: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
  maxStock: number;
}

interface CartState {
  items: CartItem[];
  stallId: string | null;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  setStall: (stallId: string) => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      stallId: null,

      setStall: (stallId) => set({ stallId, items: [] }),

      addItem: (item) => {
        const existing = get().items.find((i) => i.variantId === item.variantId);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.variantId === item.variantId
                ? { ...i, quantity: Math.min(i.quantity + 1, i.maxStock) }
                : i
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, quantity: 1 }] });
        }
      },

      removeItem: (variantId) => set({ items: get().items.filter((i) => i.variantId !== variantId) }),

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => i.variantId !== variantId) });
        } else {
          set({
            items: get().items.map((i) =>
              i.variantId === variantId ? { ...i, quantity: Math.min(quantity, i.maxStock) } : i
            ),
          });
        }
      },

      clearCart: () => set({ items: [] }),
      getTotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'pos-cart' }
  )
);
