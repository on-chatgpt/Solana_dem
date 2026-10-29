import {request} from "@/lib/api/api";

export const loginParticle = (email: string, token: string, uuid: string) => request({
  url: '/api/login/particle',
  method: 'POST',
  data: {
    email, token, uuid
  },
})
