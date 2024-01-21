import instance, { HttpStatusCode } from "axios";
import appConfig from "./app";
import cookies from "./cookie";

const axios = instance.create({
  baseURL: `${appConfig.apiUrl}/api`,
});

axios.interceptors.request.use(
  (config) => {
    const token = cookies.get(appConfig.accessTokenKey);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

axios.interceptors.response.use(
  (response) => {
    if (response.status === HttpStatusCode.Unauthorized) {
      cookies.remove(appConfig.accessTokenKey);
      window.location.reload();
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default axios;
