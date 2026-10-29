import scss from './textarea.module.scss'
import {CommonComponentProps} from "@/components/common-component-props";
import {proximaNova} from "@/app/font";

export default function Textarea({placeholder = '', className}: { placeholder: string } & CommonComponentProps) {
  return (
    <div className={`${scss.container} ${className || ''} ${proximaNova.className}`}>
      <textarea rows={4} placeholder={placeholder}/>
    </div>
  )
}
