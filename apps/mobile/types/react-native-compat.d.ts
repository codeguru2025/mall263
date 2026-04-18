// This export makes the file a module so all declare module blocks are augmentations,
// not replacements, of the actual react-native package types.
export {};

import type { ReactNode } from 'react';

/**
 * Fix for @types/react@19.x + react-native@0.81.x type incompatibility.
 *
 * React 19 tightened the Component<P,S,SS> class so that setState<K extends keyof S>
 * with S={} (keyof {}=never) is no longer assignable to Component<any,any,any>.
 * Components using Constructor<Mixin> & typeof XComponent intersection also fail
 * because TypeScript picks the mixin constructor overload as the instance type.
 *
 * Fix: Augment NativeMethods (the mixin for View/Text/Pressable etc.) and the
 * instance interfaces for the remaining problematic components (Modal, StatusBar,
 * ScrollView, FlatList, KeyboardAvoidingView, Image) with loose React.Component
 * member types that satisfy the assignability check.
 */

declare module 'react-native' {
  // ── Mixin augmentations (used by View, Text, Pressable, ActivityIndicator, etc.) ──

  interface NativeMethods {
    context: unknown;
    setState: (...args: any[]) => void;
    forceUpdate: (callback?: () => void) => void;
    render: () => ReactNode;
    props: Readonly<any>;
    state: Readonly<any>;
    refs: { [key: string]: unknown };
  }

  // ── Class instance augmentations ──
  // TypeScript merges these interfaces with the exported class declarations,
  // adding the loose React.Component members that satisfy Component<any,any,any>.

  interface Modal {
    context: unknown;
    setState: (...args: any[]) => void;
    forceUpdate: (callback?: () => void) => void;
    render: () => ReactNode;
    props: Readonly<any>;
    state: Readonly<any>;
    refs: { [key: string]: unknown };
  }

  interface StatusBar {
    context: unknown;
    setState: (...args: any[]) => void;
    forceUpdate: (callback?: () => void) => void;
    render: () => ReactNode;
    props: Readonly<any>;
    state: Readonly<any>;
    refs: { [key: string]: unknown };
  }

  interface ScrollView {
    context: unknown;
    setState: (...args: any[]) => void;
    forceUpdate: (callback?: () => void) => void;
    render: () => ReactNode;
    props: Readonly<any>;
    state: Readonly<any>;
    refs: { [key: string]: unknown };
  }

  // FlatList is generic — augment the generic interface too
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface FlatList<ItemT = any> {
    context: unknown;
    setState: (...args: any[]) => void;
    forceUpdate: (callback?: () => void) => void;
    render: () => ReactNode;
    props: Readonly<any>;
    state: Readonly<any>;
    refs: { [key: string]: unknown };
  }

  interface KeyboardAvoidingView {
    context: unknown;
    setState: (...args: any[]) => void;
    forceUpdate: (callback?: () => void) => void;
    render: () => ReactNode;
    props: Readonly<any>;
    state: Readonly<any>;
    refs: { [key: string]: unknown };
  }

  interface Image {
    context: unknown;
    setState: (...args: any[]) => void;
    forceUpdate: (callback?: () => void) => void;
    render: () => ReactNode;
    props: Readonly<any>;
    state: Readonly<any>;
    refs: { [key: string]: unknown };
  }
}

// expo-image's Image also extends PureComponent<Props, {}> which hits the same
// setState<K extends keyof {}>() vs Component<any,any,any> assignability issue.
declare module 'expo-image' {
  interface Image {
    context: unknown;
    setState: (...args: any[]) => void;
    forceUpdate: (callback?: () => void) => void;
    render: () => ReactNode;
    props: Readonly<any>;
    state: Readonly<any>;
    refs: { [key: string]: unknown };
  }
}
