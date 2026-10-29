import localFont from "next/font/local";

export const proximaNova = localFont({
  src: [
    {
      path: '../public/fonts/ProximaNova/ProximaNova-Light.otf',
      weight: '300',
    },
    {
      path: '../public/fonts/ProximaNova/ProximaNova-Regular.otf',
      weight: '400',
    },
    {
      path: '../public/fonts/ProximaNova/ProximaNova-Bold.otf',
      weight: '700',
    },
    {
      path: '../public/fonts/ProximaNova/ProximaNova-Extrabold.otf',
      weight: '800',
    },
    {
      path: '../public/fonts/ProximaNova/ProximaNova-Black.otf',
      weight: '900',
    },
  ],
})
