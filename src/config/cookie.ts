import Cookies from "universal-cookie";

const cookies: Cookies = new Cookies(null, {
  expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

export default cookies;
