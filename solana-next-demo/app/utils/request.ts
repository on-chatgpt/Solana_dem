import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";

// 创建 axios 实例
const createAxiosInstance = (): AxiosInstance => {
  // 从环境变量获取 baseURL
  const baseURL = process.env.NEXT_PUBLIC_JUPITER_REQUEST;
  console.log(baseURL, 132);
  const instance = axios.create({
    baseURL: baseURL, // 使用环境变量作为 baseURL
    timeout: 10000, // 默认超时时间 10 秒
  });

  // 响应拦截器：统一处理错误
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    (error: AxiosError) => {
      // 统一错误处理
      if (error.response) {
        // 服务器返回了错误状态码
        console.error("请求错误:", error.response.status, error.response.data);
      } else if (error.request) {
        // 请求已发出但没有收到响应
        console.error("请求超时或网络错误:", error.message);
      } else {
        // 其他错误
        console.error("请求配置错误:", error.message);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// 创建默认实例
const request = createAxiosInstance();

// 导出 axios 实例，以便需要时直接使用
export default request;
