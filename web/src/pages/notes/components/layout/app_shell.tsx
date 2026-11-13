import { memo, type ReactNode } from 'react'

import { useUiStore } from '@src/stores/ui_store'

import classes from './app_shell.module.css'



export interface IAppShellLayoutProps {
  nav:    ReactNode
  list:   ReactNode
  editor: ReactNode
  header: ReactNode
  status: ReactNode
}

export const AppShellLayout: React.NamedExoticComponent<IAppShellLayoutProps> = memo(function AppShellLayout({
  nav, list, editor, header, status,
}: IAppShellLayoutProps): React.JSX.Element {
  const { view, navOpen, listCollapsed, closeNav } = useUiStore()

  return (
    <div
      className={classes.app}
      data-list-collapsed={listCollapsed}
      data-nav-collapsed={!navOpen}
      data-nav-open={navOpen}
      data-view={view}
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
})
