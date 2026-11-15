export interface ILoginCredentials {
  email:    string
  password: string
}

export interface IRegisterCredentials extends ILoginCredentials {
  name:                 string
  passwordConfirmation: string
}

/** The only account detail that can change; the email is fixed. */
export interface IProfileUpdate {
  name: string
}
