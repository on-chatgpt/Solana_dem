'use client'
import Scaffold from "@/components/scaffold/scaffold";
import style from "./page.module.scss";
import Button from "@/components/button/button";
import Input from "@/components/input/input";
import Image from "next/image";

export default function Activation() {
  const login = async () => {
  }

  const links = [
    {icon: '/icons/discord.webp', url: ''},
    {icon: '/icons/twitter.webp', url: ''},
    {icon: '/icons/telegram.webp', url: ''},
  ]

  return (
    <Scaffold className={style.page}>
      <div className={style.top}>
        <p className={style.title}>Activation code</p>
        <p className={style.info}>Enter your activation code here,or go to our official project (Metale) and discord
          below to get one!</p>
        <Input/>
      </div>
      <div className={style.bottom}>
        <Button onClick={login} size={"large"} color={"blue"} disabled={true}>Login</Button>
        <div className={style.sns}>
          {links.map(e => <Image key={e.icon} src={e.icon} alt={''} width={20} height={20}/>)}
        </div>
      </div>
    </Scaffold>
  )
}
