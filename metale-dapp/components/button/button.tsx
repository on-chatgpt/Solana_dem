import style from './button.module.scss'
import {MouseEventHandler} from "react";
import {CommonComponentProps} from "@/components/common-component-props";
import variables from '@/app/variables.module.scss'

type ButtonProps = {
  children: string,
  onClick: MouseEventHandler<HTMLElement> | undefined,
  size?: "normal" | "large",
  color?: "yellow" | "blue",
  disabled?: boolean
} & CommonComponentProps

const s = {}

export default function Button(props: ButtonProps) {

  return (
    <div
      className={`${style.button} ${style[props.size || 'normal']} ${style[props.color || '']} ${props.className || ''}`}
      style={props.style}
      onClick={props.disabled ? undefined : props.onClick}>
      <div className={props.disabled ? style.disabledMask : undefined}>
        {props.children}
      </div>
    </div>
  )
}
