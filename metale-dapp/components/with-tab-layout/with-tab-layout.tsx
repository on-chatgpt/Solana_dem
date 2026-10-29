import React from 'react'
import styles from './styles.module.scss'
import { CommonComponentProps } from '../common-component-props'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

type WithTabLayoutProps = {
  children: React.ReactNode
} & CommonComponentProps

const tabDefs = [
  {
    href: '/home',
    activeSrc: '/images/home-active.webp',
    inactiveSrc: '/images/home-inactive.webp',
  },
  {
    href: '/rooms',
    activeSrc: '/images/rooms-active.webp',
    inactiveSrc: '/images/rooms-inactive.webp',
  },
  {
    href: '/search',
    activeSrc: '/images/search-active.webp',
    inactiveSrc: '/images/search-inactive.webp',
  },
  {
    href: '/my',
    activeSrc: '/images/my-active.webp',
    inactiveSrc: '/images/my-inactive.webp',
    alt: 'home',
  },
]

const tabs = (pathname: string) =>
  tabDefs.map((tab) => (
    <Link href={tab.href} key={tab.href}>
      <Image
        src={pathname.startsWith(tab.href) ? tab.activeSrc : tab.inactiveSrc}
        alt={tab.href.slice(1)}
        width={28}
        height={28}
      />
    </Link>
  ))

export default function WithTabLayout({
  children,
  className,
}: WithTabLayoutProps) {
  const pathname = usePathname()
  return (
    <div className={`${styles.base} ${className || ''}`}>
      <div className={styles.page}>{children}</div>
      <div className={styles.tabs}>{tabs(pathname)}</div>
    </div>
  )
}
