import React, { createContext, useCallback, useContext, useReducer } from 'react';

export interface RunCartItem {
  variantId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  imageUrl?: string | null;
}

export interface RunCartStop {
  stallId: string;
  stallName: string;
  zone: string;
  lat?: number | null;
  lng?: number | null;
  items: RunCartItem[];
}

interface CartState {
  stops: RunCartStop[];
}

type CartAction =
  | { type: 'ADD_ITEM'; stop: Omit<RunCartStop, 'items'>; item: RunCartItem }
  | { type: 'REMOVE_ITEM'; stallId: string; variantId: string }
  | { type: 'SET_QTY'; stallId: string; variantId: string; qty: number }
  | { type: 'CLEAR' };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingStop = state.stops.find((s) => s.stallId === action.stop.stallId);
      if (existingStop) {
        const existingItem = existingStop.items.find((i) => i.variantId === action.item.variantId);
        return {
          stops: state.stops.map((s) =>
            s.stallId !== action.stop.stallId
              ? s
              : {
                  ...s,
                  items: existingItem
                    ? s.items.map((i) =>
                        i.variantId === action.item.variantId
                          ? { ...i, quantity: i.quantity + action.item.quantity }
                          : i,
                      )
                    : [...s.items, action.item],
                },
          ),
        };
      }
      return {
        stops: [...state.stops, { ...action.stop, items: [action.item] }],
      };
    }
    case 'REMOVE_ITEM': {
      const newStops = state.stops
        .map((s) =>
          s.stallId !== action.stallId
            ? s
            : { ...s, items: s.items.filter((i) => i.variantId !== action.variantId) },
        )
        .filter((s) => s.items.length > 0);
      return { stops: newStops };
    }
    case 'SET_QTY': {
      if (action.qty <= 0) {
        return reducer(state, { type: 'REMOVE_ITEM', stallId: action.stallId, variantId: action.variantId });
      }
      return {
        stops: state.stops.map((s) =>
          s.stallId !== action.stallId
            ? s
            : { ...s, items: s.items.map((i) => (i.variantId === action.variantId ? { ...i, quantity: action.qty } : i)) },
        ),
      };
    }
    case 'CLEAR':
      return { stops: [] };
    default:
      return state;
  }
}

interface RunCartContextValue {
  stops: RunCartStop[];
  totalItems: number;
  totalAmount: number;
  addItem(stop: Omit<RunCartStop, 'items'>, item: RunCartItem): void;
  removeItem(stallId: string, variantId: string): void;
  setQty(stallId: string, variantId: string, qty: number): void;
  clear(): void;
}

const RunCartContext = createContext<RunCartContextValue | null>(null);

export function RunCartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { stops: [] });

  const addItem = useCallback((stop: Omit<RunCartStop, 'items'>, item: RunCartItem) => {
    dispatch({ type: 'ADD_ITEM', stop, item });
  }, []);
  const removeItem = useCallback((stallId: string, variantId: string) => {
    dispatch({ type: 'REMOVE_ITEM', stallId, variantId });
  }, []);
  const setQty = useCallback((stallId: string, variantId: string, qty: number) => {
    dispatch({ type: 'SET_QTY', stallId, variantId, qty });
  }, []);
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const totalItems = state.stops.reduce((n, s) => n + s.items.reduce((nn, i) => nn + i.quantity, 0), 0);
  const totalAmount = state.stops.reduce(
    (n, s) => n + s.items.reduce((nn, i) => nn + i.unitPrice * i.quantity, 0),
    0,
  );

  return (
    <RunCartContext.Provider value={{ stops: state.stops, totalItems, totalAmount, addItem, removeItem, setQty, clear }}>
      {children}
    </RunCartContext.Provider>
  );
}

export function useRunCart() {
  const ctx = useContext(RunCartContext);
  if (!ctx) throw new Error('useRunCart must be used inside RunCartProvider');
  return ctx;
}
