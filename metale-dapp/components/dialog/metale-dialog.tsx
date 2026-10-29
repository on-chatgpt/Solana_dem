import {Dialog, FormControl, InputLabel, MenuItem, ModalProps, Select} from "@mui/material";
import React, {MouseEventHandler, ReactNode} from "react";
import {CommonComponentProps} from "@/components/common-component-props";
import scss from './metale-dialog.module.scss'
import variables from '../../app/variables.module.scss'
import Button from "@/components/button/button";

export default function MetaleDialog({children, open, title, onClose, confirmText, onConfirmClick}: {
  children: ReactNode,
  open: boolean,
  onClose: ModalProps['onClose'],
  title?: string,
  confirmText: string,
  onConfirmClick: MouseEventHandler<HTMLElement>
} & CommonComponentProps) {
  return (
    <Dialog open={open}
            onClose={onClose}
            sx={{
              "& .MuiDialog-container": {
                "& .MuiPaper-root": {
                  width: "100%",
                  maxWidth: "95%",
                  margin: '20px',
                  borderRadius: '20px',
                  padding: '0 20px',
                },
              },
            }}>
      {title && <p className={scss.title}>{title}</p>}
      {children}
      <Button onClick={onConfirmClick} size={'large'} color={'blue'}>{confirmText}</Button>
      <div style={{height: 20}}></div>
    </Dialog>
  )
}

export function MetaleDialogLabel({children}: { children: string }) {
  return <p
    style={{
      fontSize: 14,
      color: variables.text2,
    }}>
    {children}
  </p>
}

function InputContainer({children}: { children: ReactNode }) {
  return <div className={scss.input}>
    {children}
  </div>
}

export function MetaleDialogInput({placeholder}: { placeholder?: string }) {
  return <InputContainer>
    <input placeholder={placeholder}/>
  </InputContainer>
}

// export function MetaleDialogSelect() {
//   return <InputContainer>
//     <FormControl fullWidth>
//       <InputLabel id="demo-simple-select-label">Age</InputLabel>
//       <Select
//         labelId="demo-simple-select-label"
//         id="demo-simple-select"
//         value={age}
//         label="Age"
//         onChange={handleChange}
//       >
//         <MenuItem value={10}>Ten</MenuItem>
//         <MenuItem value={20}>Twenty</MenuItem>
//         <MenuItem value={30}>Thirty</MenuItem>
//       </Select>
//     </FormControl>
//   </InputContainer>
// }
