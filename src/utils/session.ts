import cookies from "../config/cookie";
import config from "../constants/app";

export const setSession = (session: string) => {
  cookies.set(config.accessTokenKey, session);
};

export const getSession = () => {
  return cookies.get(config.accessTokenKey);
};

export const clearSession = () => {
  cookies.remove(config.accessTokenKey);
};
