'use client'
import { SWRConfig } from 'swr'
import React, { useState } from 'react'
import { Alert, Snackbar } from '@mui/material'

export const SWRProvider = ({ children }: { children: React.ReactNode }) => {
  const [msg, setMsg] = useState('')
  const [open, setOpen] = React.useState(false)

  const handleShow = (error: string) => {
    setMsg(error)
    setOpen(true)
  }

  const handleClose = (
    event: React.SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === 'clickaway') {
      return
    }

    setOpen(false)
  }

  return (
    <SWRConfig
      value={{
        onError: (error) => {
          // console.log(error, key)
          handleShow(error.message)
        },
      }}
    >
      {children}
      <Snackbar
        open={open}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        security="error"
        autoHideDuration={3000}
        onClose={handleClose}
      >
        <Alert severity="error">{msg}</Alert>
      </Snackbar>
    </SWRConfig>
  )
}
