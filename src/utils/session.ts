import config from "../config/app";
import cookies from "../config/cookie";

export const setSession = (session: string) => {
  cookies.set(config.accessTokenKey, session);
};

export const getSession = () => {
  return cookies.get(config.accessTokenKey);
};

export const clearSession = () => {
  cookies.remove(config.accessTokenKey);
};
