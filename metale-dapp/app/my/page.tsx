'use client'

import WithTabLayout from '@/components/with-tab-layout/with-tab-layout'
import styles from './styles.module.scss'
import Image from "next/image";
import {useState} from "react";
import {Snackbar} from "@mui/material";
import {setClipboard} from "@/lib/utils";
import MetaleDialog, {MetaleDialogInput, MetaleDialogLabel} from "@/components/dialog/metale-dialog";
import {particle} from "@/lib/particle";

export default function Page() {
  const [hintOpen, setHintOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)

  const handleClick = async () => {
    await setClipboard('123444')
    setHintOpen(true);
  };

  const handleClose = (event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setHintOpen(false);
  };

  const onConfirmTransfer = async () => {
    setWithdrawDialogOpen(false)
  };

  return (
    <WithTabLayout>
      <div className={styles.userInfo}>
        <div className={styles.avatar}></div>
        <div className={styles.idAndWallet}>
          <p className={styles.id}>@Standing</p>
          <p className={styles.wallet}>0xdj23….4dsEa</p>
        </div>
        <Image src={'/icons/edit.webp'} alt={''} width={20} height={20}/>
      </div>

      <div className={styles.balance}>
        <div className={styles.item}>
          <p className={styles.value}>3.1449</p>
          <p className={styles.label}>BNB balance</p>
        </div>
        <div className={styles.item}>
          <p className={styles.value}>3.1449</p>
          <p className={styles.label}>RCM balance</p>
        </div>
      </div>

      <div className={styles.action}>
        <div className={styles.item + ' ' + styles.blue} onClick={() => setWithdrawDialogOpen(true)}>
          <Image src={'/icons/withdraw.webp'} alt={''} width={42} height={42}/>
          <p className={styles.name}>Withdraw</p>
          <p className={styles.info}>Questions about</p>
        </div>
        <div className={styles.item + ' ' + styles.yellow} onClick={() => setReceiveDialogOpen(true)}>
          <Image src={'/icons/receive.webp'} alt={''} width={42} height={42}/>
          <p className={styles.name}>Receive</p>
          <p className={styles.info}>Questions about</p>
        </div>
      </div>

      <div className={styles.sectionTitle}>
        <p className={styles.title}>Invite friends</p>
        <div className={styles.info}>
          <span>Your invitation list (12)</span>
          <Image src={'/icons/arrow_right.webp'} alt={''} width={12} height={12}/>
        </div>
      </div>

      <div className={styles.invitationCode}>
        <p className={styles.code}>44534533</p>
        <div className={styles.copy} onClick={handleClick}>
          <Image src={'/icons/copy.webp'} alt={''} width={18} height={18}/>
          <p className={styles.text}>Copy Code</p>
        </div>
      </div>

      <Snackbar
        open={hintOpen}
        autoHideDuration={3000}
        onClose={handleClose}
        message="Copy Success"
      />

      <MetaleDialog
        className={'dialog'}
        open={withdrawDialogOpen}
        onClose={() => setWithdrawDialogOpen(false)}
        title={'Withdraw'}
        confirmText={'Transfer'}
        onConfirmClick={onConfirmTransfer}
      >
        <div style={{height: 38}}></div>
        <MetaleDialogLabel>Asset</MetaleDialogLabel>
        <div style={{height: 12}}></div>
        <MetaleDialogInput/>
        <div style={{height: 28}}></div>

        <MetaleDialogLabel>Amount</MetaleDialogLabel>
        <div style={{height: 12}}></div>
        <MetaleDialogInput placeholder={'Enter amount'}/>
        <div style={{height: 10}}></div>
        <div className={styles.dialogHint}>
          <p>Available: <span>1253.14RCM</span></p>
        </div>
        <div style={{height: 28}}></div>

        <MetaleDialogLabel>Address</MetaleDialogLabel>
        <div style={{height: 12}}></div>
        <MetaleDialogInput placeholder={'Enter address'}/>
        <div style={{height: 28}}></div>

      </MetaleDialog>

      <MetaleDialog
        className={'dialog'}
        open={receiveDialogOpen}
        onClose={() => setReceiveDialogOpen(false)}
        title={'Receive'}
        confirmText={'Copy Address'}
        onConfirmClick={onConfirmTransfer}
      >
        <div className={styles.receive}>
          <div style={{height: 6}}></div>
          <div className={styles.network}>BEP20(BSC)</div>
          <div style={{height: 20}}></div>
          <div style={{
            width: 180,
            height: 180,
            background: "grey",
          }}></div>
          <div style={{height: 12}}></div>
          <p className={styles.info}>Scan address to receive payment</p>
          <div style={{height: 20}}></div>
          <p className={styles.address}>0sdxshekdk9a73al00221gdnmu37csajcjm</p>
          <div style={{height: 24}}></div>
        </div>
      </MetaleDialog>
    </WithTabLayout>
  )
}
