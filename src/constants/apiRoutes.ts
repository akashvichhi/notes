const apiRoutes = {
  login: "/login",
  register: "/register",
  logout: "/logout",
  profile: {
    get: "/me",
    update: "/me",
    changePassword: "/change-password",
  },
  notes: {
    list: "/notes",
    trash: "/notes/notes-trashed",
    create: "/notes",
    get: "/notes/{id}",
    rename: "/notes/{id}/rename",
    update: "/notes/{id}",
    delete: "/notes/{id}",
    forceDelete: "/notes/{id}/force",
    restore: "/notes/{id}/restore",
    star: "/notes/{id}/star",
  },
};

export default apiRoutes;
