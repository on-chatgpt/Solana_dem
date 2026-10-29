'use client'

import React, { useEffect } from 'react'
import YellowBackground from '@/components/yellow-background/yellow-background'
import styles from './page.module.scss'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import useLocalStorage from '@/lib/storage'

export default function Page() {
  const router = useRouter()
  const [jwt] = useLocalStorage('jwt', '')
  useEffect(() => {
    setTimeout(() => {
      if (jwt) {
        router.replace('/home')
      } else {
        router.replace('/splash')
      }
    }, 2000)
  }, [])

  return (
    <YellowBackground className={styles.base}>
      <Image
        src="/images/metale-logo.webp"
        alt="metale logo"
        width={86}
        height={86}
        className={styles.logo}
      />
      <div className={styles.text}>
        Where the power of literature comes alive in your hands
      </div>
    </YellowBackground>
  )
}
