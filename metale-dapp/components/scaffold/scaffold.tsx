import React, { ReactNode } from 'react'
import styles from './scaffold.module.scss'
import { CommonComponentProps } from '@/components/common-component-props'

type ScaffoldProps = {
  children: ReactNode
} & CommonComponentProps

export default function Scaffold(props: ScaffoldProps) {
  return (
    <div className={`${styles.page} ${props.className || ''}`}>
      {props.children}
    </div>
  )
}
