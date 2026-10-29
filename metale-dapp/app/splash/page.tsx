'use client'

import React from 'react'
import Scaffold from '@/components/scaffold/scaffold'
import Button from '@/components/button/button'
import BookCard from '@/components/card/book-card'
import style from './page.module.scss'
import {useRouter} from 'next/navigation'
import {particle} from "@/lib/particle";
import {loginParticle} from "@/lib/api/account";

export default function Page() {
  const router = useRouter()
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
    const metaleLoginRes = await loginParticle(userInfo.email!, userInfo.token, userInfo.uuid)
    console.log(metaleLoginRes)
  }

  return (
    <Scaffold className={style.page + ' ' + 'vh100'}>
      <Button className={style.signIn} onClick={login}>
        Sign in
      </Button>
      <div className={style.cardList}>
        {Array.from(Array(10).keys()).map((e) => (
          <BookCard key={e}/>
        ))}
      </div>
    </Scaffold>
  )
}
