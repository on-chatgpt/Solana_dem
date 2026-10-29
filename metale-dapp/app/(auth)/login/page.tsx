'use client'

import Scaffold from "@/components/scaffold/scaffold";
import Button from "@/components/button/button";
import style from './page.module.scss'
import {particle} from "@/lib/particle";

export default function Login() {
  const login = async () => {
    const userInfo = await particle.auth.login({
      // when set social login auth type, will open thirdparty auth page directly.
      preferredAuthType: 'email',
      // when set email/phone account and preferredAuthType is email or phone,
      // Particle Auth will enter directly input verification code page.
      // when set JWT value and preferredAuthType is jwt, Particle Auth will auto login.
      // account?: string,
      supportAuthTypes: 'email', //need support social login types, split with ','. default value 'all'.
      // hideLoading?: boolean, //hide particle loading when use jwt authorization.
      // socialLoginPrompt?: string, //social login prompt.  none | consent | select_account
      // authorization: { // optional, login with authorize
      //   message: '0x...', //hex sign message.
      //   uniq: false, //optional, default false.
      // } 
    })
    //     final email = particleLoginResult["data"]["email"];
    //     final token = particleLoginResult["data"]["token"];
    //     final uuid = particleLoginResult["data"]["uuid"];
    console.log(userInfo)
  }

  return (
    <Scaffold className={style.page}>
      <p className={style.title}>Login</p>
      <Button onClick={login} size={"large"} color={"blue"}>Login</Button>
    </Scaffold>
  )
}
