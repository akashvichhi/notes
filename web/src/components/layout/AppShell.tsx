import { useMediaQuery } from '@mantine/hooks'
import type { ReactNode } from 'react'

import { useUiStore } from '@/stores/uiStore'
import classes from './shell.module.css'

export function AppShellLayout({
  nav, list, editor, header, status,
}: {
  nav: ReactNode; list: ReactNode; editor: ReactNode; header: ReactNode; status: ReactNode
}) {
  const { view, navOpen, listCollapsed, closeNav } = useUiStore()

  return (
    <div
      className={classes.app}
      data-view={view}
      data-nav-open={navOpen}
      data-nav-collapsed={!navOpen}
      data-list-collapsed={listCollapsed}
    >
      {header}
      <div className={classes.panes}>
        <aside className={classes.nav}>{nav}</aside>
        <section className={classes.list}>{list}</section>
        <section className={classes.editor}>{editor}</section>
      </div>
      <div className={classes.scrim} onClick={closeNav} />
      {status}
    </div>
  )
}

export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 767px)') ?? false
}
