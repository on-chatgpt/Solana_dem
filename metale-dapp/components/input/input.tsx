import scss from './input.module.scss'
import {CommonComponentProps} from "@/components/common-component-props";

export default function Input({placeholder = '', className}: { placeholder?: string } & CommonComponentProps) {
  return (
    <div className={`${scss.container} ${className || ''}`}>
      <input type={'text'} placeholder={placeholder}/>
    </div>
  )
}
