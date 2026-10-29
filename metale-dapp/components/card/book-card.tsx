import style from './book-card.module.scss'
import Image from 'next/image'

export default function BookCard() {
  return (
    <div className={style.card}>
      <div className={style.top}>
        <div className={style.topBg}></div>
        <div className={style.cover}></div>
        <div className={style.info}>
          <p className={style.title}>Chasing the Wind Cat</p>
          <p className={style.stat}>
            <span>99</span> Holders <span> · </span> <span>99</span> Holders
          </p>
          <p className={style.category}>Urban Romance</p>
        </div>
      </div>
      <div className={style.bottom}>
        <div className={style.spot}></div>
        <p className={style.intro}>
          If you have never burned for someone, youth is not worth mentioning!
          Sun Bo, a musician in Beijing.{' '}
        </p>
        <div className={style.author}>
          <div className={style.avatar}></div>
          <p className={style.name}>Author</p>
          <Image src={'/icons/twitter.webp'} alt={''} width={12} height={9} />
        </div>
      </div>
    </div>
  )
}
