import { memo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router'
import type { NavigateFunction } from 'react-router'

import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import type { UseFormReturnType } from '@mantine/form'
import type { UseMutationResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import { useLogin } from '@src/queries/auth_queries'
import { ROUTE_PATHS } from '@src/routes/route_paths'
import type { IUser } from '@src/types/api'
import type { ILoginCredentials } from '@src/types/auth'
import { validateEmail } from '@src/validations/auth_validations'


export const LoginPage: React.MemoExoticComponent<() => React.JSX.Element> = memo(function LoginPage() {
  const navigate: NavigateFunction = useNavigate()
  const login: UseMutationResult<IUser, IApiError, ILoginCredentials> = useLogin()

  const form: UseFormReturnType<ILoginCredentials> = useForm<ILoginCredentials>({
    initialValues: { email: '', password: '' },
    validate:      {
      email:    validateEmail,
      password: (v: string) => (v.length > 0 ? null : 'Enter your password'),
    },
  })

  const error: IApiError | null = login.error

  const handleSubmit: (values: ILoginCredentials) => void = useCallback(
    (values: ILoginCredentials): void => {
      login.mutate(values, { onSuccess: () => navigate(ROUTE_PATHS.HOME) })
    },
    [login, navigate]
  )

  return (
    <Center h="100dvh" p="md">
      <Paper withBorder maw="100%" p="xl" w={400}>
        <Title mb="lg" order={2}>Sign in</Title>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            {error && <Alert color="red">{error.message}</Alert>}

            <TextInput autoComplete="email" label="Email" {...form.getInputProps('email')} />
            <PasswordInput
              autoComplete="current-password"
              label="Password"
              {...form.getInputProps('password')}
            />

            {/* Spinner inside the button, never a full-screen loader. */}
            <Button fullWidth loading={login.isPending} type="submit">
              Sign in
            </Button>

            <Button component={Link} to={ROUTE_PATHS.REGISTER} variant="white">
              Create an account
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
})
