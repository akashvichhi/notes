import { memo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router'
import type { NavigateFunction } from 'react-router'

import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import type { UseFormReturnType } from '@mantine/form'
import type { UseMutationResult } from '@tanstack/react-query'

import type { ApiError } from '@src/api/api_client'
import { useRegister } from '@src/queries/auth_queries'
import { ROUTE_PATHS } from '@src/routes/route_paths'
import type { User } from '@src/types/api'
import type { IRegisterCredentials } from '@src/types/auth'
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '@src/validations/auth_validations'


export const RegisterPage: React.MemoExoticComponent<() => React.JSX.Element> = memo(function RegisterPage() {
  const navigate: NavigateFunction = useNavigate()
  const register: UseMutationResult<User, ApiError, IRegisterCredentials> = useRegister()

  const form: UseFormReturnType<IRegisterCredentials> = useForm<IRegisterCredentials>({
    initialValues: { name: '', email: '', password: '', password_confirmation: '' },
    validate:      {
      name:                  (v: string) => (v.trim().length > 0 ? null : 'Enter your name'),
      email:                 validateEmail,
      password:              validatePassword,
      password_confirmation: validatePasswordConfirmation,
    },
  })

  const error: ApiError | null = register.error

  const handleSubmit: (values: IRegisterCredentials) => void = useCallback(
    (values: IRegisterCredentials): void => {
      register.mutate(values, { onSuccess: () => navigate(ROUTE_PATHS.HOME) })
    },
    [navigate, register]
  )

  return (
    <Center h="100dvh" p="md">
      <Paper withBorder maw="100%" p="xl" w={400}>
        <Title mb="lg" order={2}>Create an account</Title>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            {error && <Alert color="red">{error.message}</Alert>}

            <TextInput autoComplete="name" label="Name" {...form.getInputProps('name')} />
            <TextInput autoComplete="email" label="Email" {...form.getInputProps('email')} />
            <PasswordInput
              autoComplete="new-password"
              label="Password"
              {...form.getInputProps('password')}
            />
            <PasswordInput
              autoComplete="new-password"
              label="Confirm password"
              {...form.getInputProps('password_confirmation')}
            />

            <Button fullWidth loading={register.isPending} type="submit">
              Register
            </Button>

            <Button component={Link} to={ROUTE_PATHS.LOGIN} variant="white">
              Already have an account? Sign in
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
})
