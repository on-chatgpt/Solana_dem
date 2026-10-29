'use client'
import Scaffold from "@/components/scaffold/scaffold";
import style from "./page.module.scss";
import Button from "@/components/button/button";
import Input from "@/components/input/input";
import Image from "next/image";
import scss from "@/components/input/input.module.scss";
import {TextareaAutosize} from "@mui/material";
import Textarea from "@/components/input/textarea";
import {useRouter} from "next/navigation";

export default function CreateFirstBook() {
  const router = useRouter()
  const start = async () => {
    router.push('/home')
  }

  return (
    <Scaffold className={style.page}>
      <p className={style.title}>Create your book</p>
      <p
        className={style.info}>{'You\'ll use ETH, the official currency of Base, when you buy and sell your friends\' keys.'}</p>
      <Input placeholder={'Book title'}/>
      <svg viewBox="0 0 100 100" width="100" height="100">
        <clipPath id="path" clipPathUnits="objectBoundingBox">
          <path
            d="M12.0299399,0.938771139 C15.1916361,0.312923713 18.4102276,0 21.6857143,0 C25.1626212,0 28.6395281,0.352592386 32.1164351,1.05777716 L32.1164353,1.05777582 C37.6561604,2.18134047 41.9767558,6.52601518 43.0695155,12.071899 C43.6898385,15.2201111 44,18.4247162 44,21.6857143 C44,25.1061504 43.658768,28.5265865 42.976304,31.9470226 L42.9763008,31.947022 C41.8733749,37.4747675 37.5629434,41.8019513 32.0395177,42.9263106 C28.5231778,43.6421035 25.07191,44 21.6857143,44 C18.4460199,44 15.2063255,43.6724019 11.9666312,43.0172057 L11.9666317,43.0172033 C6.4501853,41.9015564 2.13812309,37.5909768 1.02057929,32.0749144 C0.340193098,28.7166096 0,25.3583048 0,22 C0,18.6268733 0.343202605,15.2537467 1.02960782,11.88062 L1.02960679,11.8806198 C2.15520715,6.34920404 6.49260245,2.03486897 12.0299399,0.938771139 Z"/>
        </clipPath>
      </svg>
      <div className={style.cover}>
        <Image src={'/images/page-holo.webp'} alt={''} width={76} height={76}/>
        <p>The size is xxxx</p>
      </div>

      <Input placeholder={'Book classification'} className={style.classification}/>
      <Textarea placeholder={'Work content'} className={style.content}/>

      <Button onClick={start} size={"large"} color={"blue"} disabled={false}>Start using the app</Button>
    </Scaffold>
  )
}
