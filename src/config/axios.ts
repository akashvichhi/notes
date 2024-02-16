import instance, {
  AxiosError,
  AxiosResponse,
  HttpStatusCode,
  InternalAxiosRequestConfig,
} from "axios";
import appConfig from "../constants/app";
import { clearSession, getSession } from "../utils/session";
import Toast from "../utils/toast";
import { camelToSnake, snakeToCamel } from "../utils/utils";

const axios = instance.create({
  baseURL: `${appConfig.apiUrl}/api`,
});

axios.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getSession();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    try {
      if (config.data) {
        config.data = camelToSnake(config.data);
      }
    } catch (ex) {
      //
    }
    return config;
  },
  (error: AxiosError) => {
    console.error(error);
    Toast.error(
      (error.response?.data as { message: string })?.message ??
        "Something went wrong!",
      error.code,
    );
    return Promise.reject(error);
  },
);

axios.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.status === HttpStatusCode.Unauthorized) {
      clearSession();
      window.location.reload();
    }
    response.data.data = snakeToCamel(response.data.data);
    return response;
  },
  (error: AxiosError) => {
    console.error(error);
    Toast.error(
      (error.response?.data as { message: string })?.message ??
        "Something went wrong!",
      error.code,
    );
    return Promise.reject(error);
  },
);

export default axios;
