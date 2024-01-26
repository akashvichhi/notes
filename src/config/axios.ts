import instance, { HttpStatusCode } from "axios";
import appConfig from "../constants/app";
import { clearSession, getSession } from "../utils/session";

const axios = instance.create({
  baseURL: `${appConfig.apiUrl}/api`,
});

axios.interceptors.request.use(
  (config) => {
    const token = getSession();
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
      clearSession();
      window.location.reload();
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default axios;
