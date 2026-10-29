'use client'
import Scaffold from "@/components/scaffold/scaffold";
import style from "./page.module.scss";
import Button from "@/components/button/button";
import Input from "@/components/input/input";
import Image from "next/image";
import scss from "@/components/input/input.module.scss";

export default function FirstDeposit() {
  const login = async () => {
  }

  return (
    <Scaffold className={style.page}>
      <div className={style.top}>
        <p className={style.title}>Get some ETH on Bsc</p>
        <p
          className={style.info}>{'You\'ll use ETH, the official currency of Base, when you buy and sell your friends\' keys.'}</p>
        <div className={style.container}>
          <Image src={'/icons/wallet.webp'} alt={''} width={24} height={24}/>
          <div className={style.center}>
            <p>Receive on Bsc</p>
            <p>0xbE24...3a585</p>
          </div>
          <p className={style.copy}>Copy address</p>
        </div>
      </div>
      <div className={style.bottom}>
        <Button onClick={login} size={"large"} color={"blue"} disabled={true}>Proceed</Button>
        <div className={style.sns}>
          <p>Wallet Balance: 0 ETH</p>
          <Image src={'/icons/refresh.webp'} alt={''} width={16} height={16}/>
        </div>
      </div>
    </Scaffold>
  )
}
