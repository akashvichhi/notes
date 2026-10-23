import { memo, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'


import { normalizeError } from '@/api/client'
import { useLogin } from '@/hooks/queries/useAuth'
import { validateEmail } from '@/lib/validation'
import { isNative } from '@/platform/isNative'

export const LoginPage = memo(function LoginPage() {
  const navigate = useNavigate()
  const login = useLogin()
  const native = isNative()

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate:      {
      email:    validateEmail,
      password: (v) => (v.length > 0 ? null : 'Enter your password'),
    },
  })

  const error = useMemo(() => (login.error ? normalizeError(login.error) : null), [login.error])

  const handleSubmit = useCallback(
    (values: { email: string; password: string }) => {
      login.mutate(values, { onSuccess: () => navigate('/') })
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

            <Button component={Link} to="/register" variant="white">
              Create an account
            </Button>

            {native && (
              <Button component={Link} to="/" variant="subtle">
                Continue without signing in (local notes)
              </Button>
            )}
          </Stack>
        </form>
      </Paper>
    </Center>
  )
})
