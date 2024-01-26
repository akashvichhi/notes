const apiRoutes = {
  login: "/login",
  register: "/register",
  logout: "/logout",
  profile: {
    get: "/me",
    update: "/me",
    changePassword: "/change-password",
  },
};

export default apiRoutes;
