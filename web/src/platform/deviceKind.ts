import { platform } from '@tauri-apps/plugin-os'

import { isNative } from './isNative'

export type Platform = 'windows' | 'macos' | 'linux' | 'android' | 'ios'
export interface DeviceKind { icon: 'laptop' | 'phone' | 'tablet'; noun: string }

/** Pure, so it can be tested without a Tauri runtime. */
export function deviceKindFor(p: Platform | null, viewportWidth: number): DeviceKind {
  if (p === 'ios' || p === 'android') {
    return viewportWidth >= 768
      ? { icon: 'tablet', noun: 'this tablet' }
      : { icon: 'phone', noun: 'this phone' }
  }

  return { icon: 'laptop', noun: 'this computer' }
}

export function deviceKind(): DeviceKind {
  const p = isNative() ? (platform() as Platform) : null
  return deviceKindFor(p, window.innerWidth)
}
