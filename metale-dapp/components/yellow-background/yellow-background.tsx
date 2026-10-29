import React from 'react'
import styles from './styles.module.scss'
import { CommonComponentProps } from '../common-component-props'

type YellowBackgroundProps = {
  children: React.ReactNode
} & CommonComponentProps

export default function YellowBackground({
  children,
  className,
}: YellowBackgroundProps) {
  return <div className={`${styles.base} ${className || ''}`}>{children}</div>
}
