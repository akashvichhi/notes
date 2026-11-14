export interface ILoginCredentials {
  email:    string
  password: string
}

export interface IRegisterCredentials extends ILoginCredentials {
  name:                  string
  passwordConfirmation: string
}
